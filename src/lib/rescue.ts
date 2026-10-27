import { createClient } from "@supabase/supabase-js";
import { emailOnboardingParado, enviarEmail } from "./email";
import { SUPORTE_WHATSAPP } from "./suporte";

// Rescue: o agente de retenção da ivva. Regras fixas (nada de desconto inventado pela IA), executadas pelo cron
// diário. Fase 1: quem não preencheu nada recebe contato a cada 5 dias; presente "plano acima por 30 dias".

/**
 * Ticket médio de referência por tipo de negócio, só para a estimativa dos e-mails (o número aparece sempre como
 * estimativa, com a conta à mostra). Quando o negócio tiver pagamentos lançados, vale o ticket dele.
 */
const TICKET_REFERENCIA: Record<string, number> = {
  "salao-beleza": 90,
  barbearia: 50,
  "clinica-estetica": 200,
  odontologia: 250,
  advocacia: 400,
  imoveis: 150,
  comercio: 120,
  pet: 90,
  academia: 150,
  restaurante: 60,
  "servicos-gerais": 200,
  floricultura: 120,
  outro: 150,
};

/** Atendimentos por mês que a conta supõe recuperados (mensagens fora do horário ou respondidas tarde demais). */
export const ATENDIMENTOS_RECUPERADOS = 8;

export function estimativaGanho(segmento: string | null | undefined): { ticket: number; atendimentos: number; total: number } {
  const ticket = TICKET_REFERENCIA[segmento ?? ""] ?? TICKET_REFERENCIA.outro;
  return { ticket, atendimentos: ATENDIMENTOS_RECUPERADOS, total: ticket * ATENDIMENTOS_RECUPERADOS };
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Texto da mensagem de WhatsApp que o Vespa manda pelo /admin (o envio automático depende da aprovação da Meta). */
export function mensagemWhatsappOnboarding(p: { nome: string | null; negocio: string | null; segmento: string | null; etapa: number }) {
  const primeiro = (p.nome ?? "").trim().split(/\s+/)[0];
  const est = estimativaGanho(p.segmento);
  const ola = primeiro ? `Oi, ${primeiro}! Aqui é o Diego, da ivva.` : "Oi! Aqui é o Diego, da ivva.";
  if (p.etapa <= 1) {
    return `${ola} Que bom ter ${p.negocio ?? "o seu negócio"} com a gente! Vi que o robô ainda não tem as informações do negócio. Com ${est.atendimentos} atendimentos a mais por mês, a ivva pode render cerca de ${brl(est.total)} por mês para vocês. Quer que eu te ajude a preencher agora? Leva uns 15 minutos.`;
  }
  return `${ola} O robô do ${p.negocio ?? "seu negócio"} ainda está esperando as informações para começar a atender. Se preferir, me manda um áudio aqui com os serviços, preços e horários que eu mesmo preencho para você. Combinado?`;
}

export function linkWhatsapp(telefone: string | null | undefined, texto: string): string | null {
  const so = (telefone ?? "").replace(/\D/g, "");
  if (so.length < 10) return null;
  const numero = so.length <= 11 ? `55${so}` : so;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export const LINK_SUPORTE_RESCUE = `https://wa.me/${SUPORTE_WHATSAPP}`;

type Parado = {
  tenant_id: string;
  negocio: string | null;
  segmento: string | null;
  plano: string | null;
  dono_nome: string | null;
  dono_email: string;
  telefone: string | null;
  dias: number;
  etapa: number;
};

/** Roda no cron diário. Nunca derruba o cron: cada parte tem a sua proteção. */
export async function processarRescue(): Promise<{ onboarding: number; bonusAplicados: number; bonusEncerrados: number }> {
  const out = { onboarding: 0, bonusAplicados: 0, bonusEncerrados: 0 };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) return out;
  const supabase = createClient(url, anon);

  // 1. Negócios sem nada preenchido: e-mail no dia 5, 10, 15... até o dia 30.
  try {
    const { data, error } = await supabase.rpc("rescue_onboarding_parados", { p_secret: secret });
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as Parado[]) {
      const envio = await enviarEmail({
        para: p.dono_email,
        ...emailOnboardingParado({ nome: p.dono_nome, negocio: p.negocio, etapa: p.etapa, estimativa: estimativaGanho(p.segmento) }),
      });
      if (!envio.ok) continue;
      await supabase.rpc("rescue_registrar", {
        p_secret: secret,
        p_tenant: p.tenant_id,
        p_email: p.dono_email,
        p_tipo: "onboarding_parado",
        p_etapa: p.etapa,
        p_canal: "email",
        p_detalhe: { dias: p.dias },
      });
      out.onboarding++;
    }
  } catch (err) {
    console.error("[rescue] falha no acompanhamento de preenchimento", err);
  }

  // 2. Presente "30 dias do plano acima": liga uma vez por negócio; depois de 30 dias volta ao plano contratado.
  try {
    const { data } = await supabase.rpc("rescue_bonus_pendentes", { p_secret: secret });
    for (const b of (data ?? []) as { tenant_id: string }[]) {
      const { data: plano } = await supabase.rpc("rescue_aplicar_bonus", { p_secret: secret, p_tenant: b.tenant_id, p_dias: 30 });
      if (plano) out.bonusAplicados++;
    }
    const { data: encerrados } = await supabase.rpc("rescue_encerrar_bonus", { p_secret: secret });
    out.bonusEncerrados = Number(encerrados ?? 0);
  } catch (err) {
    console.error("[rescue] falha no plano bônus", err);
  }

  return out;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONVERSAS_POR_PLANO,
  FOLGA_PERCENTUAL,
  PACOTE_AVULSO,
  RESPOSTAS_POR_CONVERSA_MAX,
} from "./planos";
import { getCheckoutSession } from "./stripe";

// Limite mensal de conversas da IA por cliente (tenant). A contagem e as regras
// vivem no banco (ia_consumir_conversa); aqui ficam as chamadas e os textos de estado.

export type ResultadoConsumo = {
  permitido: boolean;
  // "limite_mes" (acabou) | "limite_respostas_conversa" (conversa longa demais) | outro
  motivo: string | null;
  // Cruzou 80, 90 ou 100% do plano pela primeira vez neste mês (0 = nenhum limiar novo).
  nivelAvisoNovo: number;
  // true quando o contador falhou e deixamos a IA responder mesmo assim.
  contadorFalhou: boolean;
};

/**
 * Chamar ANTES de cada resposta da IA a um cliente final. Se o contador falhar
 * (banco fora do ar, erro inesperado), deixa a IA responder: o atendimento do
 * negócio do cliente vale mais do que uma conversa contada a menos.
 */
export async function consumirConversaIA(
  supabase: SupabaseClient,
  internalSecret: string,
  tenantId: string,
  contactId: string,
): Promise<ResultadoConsumo> {
  const { data, error } = await supabase.rpc("ia_consumir_conversa", {
    p_secret: internalSecret,
    p_tenant_id: tenantId,
    p_contact_id: contactId,
    p_limites: CONVERSAS_POR_PLANO,
    p_folga_pct: FOLGA_PERCENTUAL,
    p_max_respostas: RESPOSTAS_POR_CONVERSA_MAX,
  });

  if (error || !data) {
    console.error("[uso-ia] falha ao contar conversa — deixando a IA responder", error);
    return { permitido: true, motivo: null, nivelAvisoNovo: 0, contadorFalhou: true };
  }

  const r = data as { permitido?: boolean; motivo?: string; nivel_aviso_novo?: number };
  // "tenant_nao_encontrado" não deve travar o atendimento: trata como falha do contador.
  if (r.permitido === false && r.motivo === "tenant_nao_encontrado") {
    console.error("[uso-ia] tenant sem limite definido — deixando a IA responder", tenantId);
    return { permitido: true, motivo: null, nivelAvisoNovo: 0, contadorFalhou: true };
  }
  return {
    permitido: r.permitido !== false,
    motivo: r.motivo ?? null,
    nivelAvisoNovo: r.nivel_aviso_novo ?? 0,
    contadorFalhou: false,
  };
}

export type ResumoUso = {
  limite: number;
  usado_plano: number;
  usado_extra: number;
  usado_folga: number;
  folga_max: number;
  saldo_extra: number;
  percentual: number;
  bloqueios: number;
  renova_em: string;
};

/** Uso do mês do negócio do usuário logado (null se não houver perfil). */
export async function obterResumoUso(supabase: SupabaseClient): Promise<ResumoUso | null> {
  const { data, error } = await supabase.rpc("ia_uso_resumo", {
    p_limites: CONVERSAS_POR_PLANO,
    p_folga_pct: FOLGA_PERCENTUAL,
  });
  if (error || !data) return null;
  return data as ResumoUso;
}

export type EstadoUso =
  | "ok"
  | "aviso80"
  | "aviso90"
  | "usando_avulso"
  | "esgotado_folga"
  | "bloqueado";

export function estadoDoUso(r: ResumoUso): EstadoUso {
  const planoAcabou = r.usado_plano >= r.limite;
  if (planoAcabou && r.saldo_extra <= 0) {
    return r.usado_folga >= r.folga_max ? "bloqueado" : "esgotado_folga";
  }
  if (planoAcabou) return "usando_avulso";
  if (r.percentual >= 90) return "aviso90";
  if (r.percentual >= 80) return "aviso80";
  return "ok";
}

/**
 * Confere na Stripe as compras de crédito ainda não confirmadas deste negócio e
 * credita as pagas (idempotente: uma compra nunca credita duas vezes). Devolve
 * quantas conversas foram creditadas agora. Chamado ao voltar do pagamento e,
 * por garantia, quando há compra pendente (se o cliente fechou a aba antes de voltar).
 */
export async function reconciliarCreditos(supabase: SupabaseClient): Promise<number> {
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return 0;

  const { data: pendentes } = await supabase.rpc("ia_creditos_pendentes");
  const ids = ((pendentes ?? []) as { stripe_session_id: string }[]).map((p) => p.stripe_session_id);
  let creditadas = 0;

  for (const id of ids) {
    try {
      const sessao = await getCheckoutSession(id);
      const ehNosso = sessao.metadata?.tipo === "creditos_conversas";
      const valorCerto = sessao.amount_total === PACOTE_AVULSO.valorCentavos;
      if (sessao.payment_status !== "paid" || !ehNosso || !valorCerto) continue;

      const { data } = await supabase.rpc("ia_creditos_confirmar", {
        p_secret: secret,
        p_stripe_session_id: id,
      });
      const r = data as { ok?: boolean; ja_creditado?: boolean; conversas?: number } | null;
      if (r?.ok && !r.ja_creditado) creditadas += r.conversas ?? 0;
    } catch (err) {
      console.error("[uso-ia] falha ao conferir compra de crédito", id, err);
    }
  }
  return creditadas;
}

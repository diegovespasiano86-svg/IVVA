import { createClient } from "@supabase/supabase-js";
import { creditarCliente, situacaoAssinatura } from "./stripe";
import { precoMensal } from "./planos";

// Indique e ganhe: cada indicado PAGANTE vale 1 mês grátis do plano de quem indicou, até 6 meses. "Pagante" = a assinatura
// do indicado está ativa (teste grátis já terminou e a 1ª mensalidade foi paga) e tem pelo menos 30 dias. Roda todo dia no cron.

/** Limite de meses grátis que uma pessoa pode ganhar indicando. */
export const MAX_MESES_INDICACAO = 6;

export const REGRAS_INDICACAO = [
  "Cada pessoa que você indicar e virar cliente pagante vale 1 mês grátis do seu plano.",
  `Você pode acumular até ${MAX_MESES_INDICACAO} meses grátis.`,
  "Vale para quem ainda não tem conta na ivva e assina pelo seu link.",
  "O mês é liberado quando o indicado já pagou a primeira mensalidade (depois do teste grátis) e a assinatura dele tem pelo menos 30 dias e continua ativa.",
  "O valor de 1 mês do seu plano entra como crédito na sua assinatura e abate a próxima cobrança. Se sobrar, abate as seguintes.",
  "Quem foi indicado ganha 10% de desconto na primeira mensalidade, aplicado automaticamente no pagamento (planos mensais).",
  "Não vale indicar a si mesmo nem quem já tem conta na ivva, e cada pessoa indicada conta uma vez.",
  "A ivva pode recusar indicações que pareçam fraude.",
];

type Pendente = {
  indicacao_id: string;
  valor_centavos: number;
  indicador_customer_id: string | null;
  indicado_customer_id: string | null;
  indicador_plano: string | null;
  pagas_do_indicador: number | null;
};

export async function processarIndicacoes(): Promise<{ pagas: number; recusadas: number; aguardando: number; falhas: number }> {
  const out = { pagas: 0, recusadas: 0, aguardando: 0, falhas: 0 };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) return out;

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.rpc("indicacoes_a_pagar", { p_secret: secret });
  if (error) {
    console.error("[indicacao] falha ao listar", error.message);
    out.falhas++;
    return out;
  }

  const resolver = (id: string, status: "paga" | "recusada", motivo: string, valor?: number) =>
    supabase.rpc("indicacao_resolver", { p_secret: secret, p_id: id, p_status: status, p_motivo: motivo, p_valor: valor ?? null });
  // Meses já ganhos por quem indicou, contando os pagos nesta mesma rodada.
  const ganhos = new Map<string, number>();

  for (const p of (data ?? []) as Pendente[]) {
    try {
      if (!p.indicador_customer_id) {
        await resolver(p.indicacao_id, "recusada", "indicador_sem_assinatura");
        out.recusadas++;
        continue;
      }
      if (!p.indicado_customer_id) {
        out.aguardando++;
        continue;
      }
      const indicado = await situacaoAssinatura(p.indicado_customer_id);
      if (indicado.estado === "cancelada" || indicado.estado === "inexistente") {
        await resolver(p.indicacao_id, "recusada", "indicado_cancelou");
        out.recusadas++;
        continue;
      }
      if (indicado.estado === "aguardar") {
        out.aguardando++;
        continue;
      }
      const indicador = await situacaoAssinatura(p.indicador_customer_id);
      if (indicador.estado === "cancelada" || indicador.estado === "inexistente") {
        await resolver(p.indicacao_id, "recusada", "indicador_sem_assinatura");
        out.recusadas++;
        continue;
      }
      const jaGanhos = ganhos.get(p.indicador_customer_id) ?? p.pagas_do_indicador ?? 0;
      if (jaGanhos >= MAX_MESES_INDICACAO) {
        await resolver(p.indicacao_id, "recusada", "limite_6_meses");
        out.recusadas++;
        continue;
      }
      const centavos = precoMensal(p.indicador_plano) * 100;
      await creditarCliente({
        customerId: p.indicador_customer_id,
        centavos,
        descricao: "Indique e ganhe ivva: 1 mês grátis do seu plano",
        chave: `indicacao-${p.indicacao_id}`,
      });
      ganhos.set(p.indicador_customer_id, jaGanhos + 1);
      await resolver(p.indicacao_id, "paga", "credito_stripe", centavos);
      out.pagas++;
    } catch (err) {
      console.error("[indicacao] falha ao processar", p.indicacao_id, err);
      out.falhas++;
    }
  }
  return out;
}

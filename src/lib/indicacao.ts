import { createClient } from "@supabase/supabase-js";
import { creditarCliente, situacaoAssinatura } from "./stripe";

// Indique e ganhe: R$ 150 de desconto na mensalidade seguinte de quem indicou, quando o indicado contrata um plano MENSAL
// e a assinatura dele segue ativa 30 dias depois da contratação. Roda todo dia no cron existente.

export const REGRAS_INDICACAO = [
  "Quem indica ganha R$ 150 de desconto na mensalidade seguinte.",
  "Vale para quem ainda não tem conta na ivva e assina pelo seu link, escolhendo um plano mensal.",
  "O desconto é liberado 30 dias depois da contratação do plano do indicado, se a assinatura dele continuar ativa.",
  "O valor entra como crédito na sua assinatura e abate a próxima mensalidade. Se sobrar, abate as seguintes.",
  "Planos anuais não participam da indicação.",
  "Não vale indicar a si mesmo nem quem já tem conta na ivva, e cada pessoa indicada conta uma vez.",
  "A ivva pode recusar indicações que pareçam fraude.",
];

type Pendente = {
  indicacao_id: string;
  valor_centavos: number;
  indicador_customer_id: string | null;
  indicado_customer_id: string | null;
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

  const resolver = (id: string, status: "paga" | "recusada", motivo: string) =>
    supabase.rpc("indicacao_resolver", { p_secret: secret, p_id: id, p_status: status, p_motivo: motivo });

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
      if (!indicado.mensal) {
        await resolver(p.indicacao_id, "recusada", "plano_anual");
        out.recusadas++;
        continue;
      }
      const indicador = await situacaoAssinatura(p.indicador_customer_id);
      if (indicador.estado === "cancelada" || indicador.estado === "inexistente") {
        await resolver(p.indicacao_id, "recusada", "indicador_sem_assinatura");
        out.recusadas++;
        continue;
      }
      await creditarCliente({
        customerId: p.indicador_customer_id,
        centavos: p.valor_centavos,
        descricao: "Indique e ganhe ivva: desconto na próxima mensalidade",
        chave: `indicacao-${p.indicacao_id}`,
      });
      await resolver(p.indicacao_id, "paga", "credito_stripe");
      out.pagas++;
    } catch (err) {
      console.error("[indicacao] falha ao processar", p.indicacao_id, err);
      out.falhas++;
    }
  }
  return out;
}

import { createClient } from "@supabase/supabase-js";
import { formaDoMP, lerContaMP, mp } from "@/lib/mercadopago";

// Confere no Mercado Pago do próprio vendedor se uma cobrança pendente já foi paga e, se sim, dá a baixa (venda, estoque, comissão).
// O webhook continua sendo o caminho principal; isto cobre o aviso que não chega ou demora. Repetir é seguro: cobranca_paga_id ignora repetição.
export async function conferirCobrancaMP(c: { id: string; tenant_id: string; valor: number | string }): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) return false;
  try {
    const conta = await lerContaMP(c.tenant_id);
    if (!conta) return false;
    const r = await mp<{ results?: { status?: string; transaction_amount?: number; payment_type_id?: string }[] }>(
      conta,
      `/v1/payments/search?external_reference=${encodeURIComponent(c.id)}&sort=date_created&criteria=desc&limit=5`,
    );
    const pago = (r.results ?? []).find((p) => p.status === "approved");
    if (!pago) return false;
    await createClient(url, anon).rpc("cobranca_paga_id", {
      p_secret: secret,
      p_id: c.id,
      p_tenant: c.tenant_id,
      p_valor: Number(pago.transaction_amount ?? c.valor),
      p_forma: formaDoMP(pago.payment_type_id),
    });
    return true;
  } catch (e) {
    console.error("[conferir-mp] falhou", e);
    return false;
  }
}

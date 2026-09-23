import type { SupabaseClient } from "@supabase/supabase-js";
import { getPriceIdAtivo } from "./stripe";

const PLANO_POR_PRICE_ID: Record<string, string> = {
  [process.env.STRIPE_PRICE_ESSENCIAL ?? ""]: "essencial",
  [process.env.STRIPE_PRICE_PROFISSIONAL ?? ""]: "profissional",
  [process.env.STRIPE_PRICE_COMPLETO ?? ""]: "completo",
};

// Sem webhook configurado, trocar de plano pelo Portal de cobrança da
// Stripe não avisa a gente — então sincroniza sob demanda (chamado toda
// vez que o dono abre Conta e assinatura) em vez de confiar num valor que
// pode estar desatualizado desde a última troca. Mesma filosofia do
// getCheckoutSession: consulta a Stripe direto, sem guardar estado que
// pode ficar velho.
export async function sincronizarPlanoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  stripeCustomerId: string | null,
): Promise<string | null> {
  if (!stripeCustomerId) return null;

  let priceId: string | null;
  try {
    priceId = await getPriceIdAtivo(stripeCustomerId);
  } catch (err) {
    console.error("[sincronizar-plano] falha ao consultar Stripe", err);
    return null;
  }
  if (!priceId) return null;

  const planoAtivo = PLANO_POR_PRICE_ID[priceId];
  if (!planoAtivo) return null;

  const { data: tenantAtual } = await supabase
    .from("tenants")
    .select("plano")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantAtual?.plano === planoAtivo) return planoAtivo;

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) {
    console.error("[sincronizar-plano] WHATSAPP_WEBHOOK_INTERNAL_SECRET não configurado");
    return null;
  }

  const { error } = await supabase.rpc("sincronizar_plano_tenant", {
    p_secret: secret,
    p_tenant_id: tenantId,
    p_plano: planoAtivo,
  });
  if (error) {
    console.error("[sincronizar-plano] falha ao gravar plano sincronizado", error);
    return null;
  }

  return planoAtivo;
}

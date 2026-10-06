"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCreditosCheckoutSession } from "@/lib/stripe";
import { PACOTE_AVULSO } from "@/lib/planos";

// Compra de crédito avulso: abre o pagamento da Stripe já com o pacote pronto
// (um clique, sem formulário). Ao voltar, /conta confere o pagamento e credita.
export async function comprarCreditos(_prevState: string | undefined): Promise<string | undefined> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sessão expirada, faça login de novo.";

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || perfil.role !== "dono") {
    return "Só o dono do negócio pode comprar créditos.";
  }

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return "Não foi possível abrir o pagamento agora. Fale com a gente.";

  const { data: assinatura } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", perfil.tenant_id)
    .maybeSingle();

  const headerList = await headers();
  const origin = headerList.get("origin") ?? `https://${headerList.get("host") ?? "localhost:3000"}`;

  let session;
  try {
    session = await createCreditosCheckoutSession({
      customerId: assinatura?.stripe_customer_id ?? null,
      tenantId: perfil.tenant_id,
      conversas: PACOTE_AVULSO.conversas,
      valorCentavos: PACOTE_AVULSO.valorCentavos,
      successUrl: `${origin}/conta?creditos=ok`,
      cancelUrl: `${origin}/conta?creditos=cancelado`,
    });
  } catch (err) {
    return err instanceof Error ? err.message : "Falha ao abrir o pagamento dos créditos.";
  }

  const { error } = await supabase.rpc("ia_creditos_registrar_compra", {
    p_secret: secret,
    p_tenant_id: perfil.tenant_id,
    p_stripe_session_id: session.id,
    p_conversas: PACOTE_AVULSO.conversas,
    p_valor_centavos: PACOTE_AVULSO.valorCentavos,
  });
  if (error) {
    console.error("[creditos] falha ao registrar compra", error);
    return "Não foi possível abrir o pagamento agora. Tente de novo em instantes.";
  }

  redirect(session.url);
}

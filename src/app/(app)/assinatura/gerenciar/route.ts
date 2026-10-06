import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBillingPortalSession } from "@/lib/stripe";
import { origemDoApp } from "@/lib/origem";

// app.ivva.app.br/assinatura/gerenciar: abre o portal seguro da Stripe (trocar plano, cartão, faturas) já com
// o cliente identificado. Quem não é o dono, ou não tem assinatura, volta para /assinatura com um aviso.
export async function GET(req: NextRequest) {
  const origem = await origemDoApp();
  const voltar = (erro: string) => NextResponse.redirect(`${origem}/assinatura?erro=${erro}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origem}/login`);

  const { data: perfil } = await supabase.from("users").select("tenant_id, role").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.role !== "dono") return voltar("dono");

  const { data: assinatura } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", perfil.tenant_id)
    .maybeSingle();
  if (!assinatura?.stripe_customer_id) return voltar("sem-assinatura");

  const acao = req.nextUrl.searchParams.get("acao");
  try {
    const sessao = await createBillingPortalSession({
      customerId: assinatura.stripe_customer_id,
      returnUrl: `${origem}/assinatura`,
      fluxo: acao === "cartao" ? "payment_method_update" : undefined,
    });
    return NextResponse.redirect(sessao.url);
  } catch (err) {
    console.error("[assinatura] portal", err instanceof Error ? err.message : err);
    return voltar("portal");
  }
}

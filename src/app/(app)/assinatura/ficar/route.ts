import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aceitarOfertaFicar, cancelamentoAgendado } from "@/lib/stripe";
import { origemDoApp } from "@/lib/origem";

// Rescue: botão "Quero ficar com 30%" da tela Minha assinatura (aparece só com o cancelamento agendado).
// Desfaz o cancelamento na Stripe e aplica o desconto, se a assinatura ainda não tiver outro.
export async function POST() {
  const origem = await origemDoApp();
  const voltar = (q: string) => NextResponse.redirect(`${origem}/assinatura?${q}`, { status: 303 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origem}/login`, { status: 303 });

  const { data: perfil } = await supabase.from("users").select("tenant_id, role").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.role !== "dono") return voltar("erro=dono");

  const { data: assinatura } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", perfil.tenant_id)
    .maybeSingle();
  if (!assinatura?.stripe_customer_id) return voltar("erro=sem-assinatura");

  try {
    const agendado = await cancelamentoAgendado(assinatura.stripe_customer_id);
    if (!agendado) return voltar("ok=ficou");
    await aceitarOfertaFicar(agendado.id, agendado.porData, !agendado.jaTemDesconto);
    return voltar(agendado.jaTemDesconto ? "ok=ficou" : "ok=ficou30");
  } catch (err) {
    console.error("[assinatura] ficar", err instanceof Error ? err.message : err);
    return voltar("erro=ficar");
  }
}

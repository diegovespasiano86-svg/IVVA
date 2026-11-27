import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmarCartao } from "@/lib/teste-gratis";

// Volta da Stripe: confere o pagamento e liga o cartão ao negócio.
export async function GET(request: NextRequest) {
  const ir = (caminho: string) => NextResponse.redirect(new URL(caminho, request.url));
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return ir("/login");
  const { data: perfil } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!perfil || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return ir("/assinatura");
  try {
    if (await confirmarCartao(sessionId, perfil.tenant_id)) return ir("/assinatura?ok=cartao");
  } catch (err) {
    console.error("[cartao] falha ao confirmar", err instanceof Error ? err.message : err);
  }
  return ir("/assinatura?erro=cartao");
}

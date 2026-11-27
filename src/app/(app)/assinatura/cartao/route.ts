import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { origemDoApp } from "@/lib/origem";
import { abrirCadastroDoCartao, lerTesteGratis } from "@/lib/teste-gratis";

// Leva o dono à página segura da Stripe para guardar o cartão durante o período grátis (hoje R$ 0).
export async function GET(request: NextRequest) {
  const ir = (caminho: string) => NextResponse.redirect(new URL(caminho, request.url));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return ir("/login");
  const { data: perfil } = await supabase.from("users").select("tenant_id, role").eq("id", user.id).maybeSingle();
  if (perfil?.role !== "dono") return ir("/assinatura?erro=dono");
  const teste = await lerTesteGratis(supabase, perfil.tenant_id);
  if (!teste || teste.cartao_em) return ir("/assinatura");
  try {
    const url = await abrirCadastroDoCartao({ tenantId: perfil.tenant_id, email: user.email ?? "", fim: teste.fim, origem: await origemDoApp() });
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[cartao] falha ao abrir", err instanceof Error ? err.message : err);
    return ir("/assinatura?erro=cartao");
  }
}

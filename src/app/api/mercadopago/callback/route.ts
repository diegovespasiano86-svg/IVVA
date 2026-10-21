import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { origemDoApp } from "@/lib/origem";
import { salvarContaMP, trocarCodigo } from "@/lib/mercadopago";

// Retorno do OAuth: confere o state, troca o código pelos tokens do vendedor e guarda criptografado.
export async function GET(req: NextRequest) {
  const origem = await origemDoApp();
  const fim = (mp: string) => {
    const res = NextResponse.redirect(`${origem}/integracoes?mp=${mp}`);
    res.cookies.delete({ name: "mp_state", path: "/api/mercadopago" });
    return res;
  };

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const esperado = req.cookies.get("mp_state")?.value;
  if (!code || !state || !esperado || state !== esperado) return fim("erro");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origem}/login`);
  const { data: perfil } = await supabase.from("users").select("tenant_id, role").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.role !== "dono") return fim("so_dono");

  try {
    const t = await trocarCodigo(code, `${origem}/api/mercadopago/callback`);
    await salvarContaMP(perfil.tenant_id, t);
  } catch (e) {
    console.error("[mercadopago] callback", e);
    return fim("erro");
  }
  return fim("ok");
}

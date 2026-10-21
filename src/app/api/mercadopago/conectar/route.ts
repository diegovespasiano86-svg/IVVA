import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { origemDoApp } from "@/lib/origem";
import { mpDisponivel } from "@/lib/mercadopago";

// Começa a conexão com o Mercado Pago: o dono entra na conta dele e autoriza a ivva (OAuth). Volta em /api/mercadopago/callback.
export async function GET() {
  const origem = await origemDoApp();
  if (!mpDisponivel()) return NextResponse.redirect(`${origem}/integracoes?mp=indisponivel`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origem}/login`);
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (perfil?.role !== "dono") return NextResponse.redirect(`${origem}/integracoes?mp=so_dono`);

  const state = randomBytes(16).toString("hex");
  const url = new URL("https://auth.mercadopago.com.br/authorization");
  url.searchParams.set("client_id", process.env.MERCADOPAGO_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", `${origem}/api/mercadopago/callback`);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("mp_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/mercadopago" });
  return res;
}

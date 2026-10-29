import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cifrar, emailDoGoogle, lerState, sincronizarGoogleAgenda, trocarCodigo } from "@/lib/google-agenda";

// Volta do Google: guarda o acesso (criptografado) e já manda os próximos agendamentos para a agenda.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const volta = (resultado: string) => NextResponse.redirect(`${url.origin}/integracoes?google=${resultado}`);

  const code = url.searchParams.get("code");
  const userDoState = lerState(url.searchParams.get("state") ?? "");
  if (url.searchParams.get("error") || !code || !userDoState) return volta("negado");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userDoState) return volta("erro");

  const { data: perfil } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!perfil || !secret) return volta("erro");

  try {
    const t = await trocarCodigo(code);
    if (!t.refresh_token) return volta("erro");
    // O Google deixa a pessoa desmarcar a permissão da agenda: sem ela todo evento volta 403, então não conecta.
    if (!t.scope?.includes("auth/calendar.events")) return volta("negado");
    const email = await emailDoGoogle(t.access_token);
    const { error } = await supabase.rpc("google_agenda_salvar", {
      p_secret: secret,
      p_tenant_id: perfil.tenant_id,
      p_user_id: user.id,
      p_email: email,
      p_token_enc: cifrar(t.refresh_token),
    });
    if (error) throw error;
    await sincronizarGoogleAgenda(perfil.tenant_id);
    return volta("ok");
  } catch (e) {
    console.error("[google-agenda] callback", e);
    return volta("erro");
  }
}

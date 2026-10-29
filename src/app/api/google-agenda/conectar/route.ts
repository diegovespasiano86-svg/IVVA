import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assinarState, googleConfigurado, urlAutorizacao } from "@/lib/google-agenda";

// Começa a ligação com o Google Agenda: leva o usuário logado para a tela de permissão do Google.
export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  if (!googleConfigurado()) return NextResponse.redirect(`${base}/integracoes?google=indisponivel`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${base}/login`);

  return NextResponse.redirect(urlAutorizacao(assinarState(user.id)));
}

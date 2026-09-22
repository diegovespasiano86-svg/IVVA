import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ponto de retorno dos links de e-mail do Supabase (recuperação de senha,
// confirmação, convite) — troca o "code" da URL por uma sessão de verdade
// antes de mandar o usuário pra tela final (redefinir senha, etc).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=link_invalido`);
}

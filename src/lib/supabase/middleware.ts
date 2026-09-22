import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Mantém a sessão do Supabase sempre atualizada a cada request (necessário
// pro App Router — sem isso o usuário é deslogado sozinho depois de um tempo).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rotas de API (webhooks da Meta/Stripe) e o callback de auth (troca o
  // código do link de e-mail por sessão) nunca têm sessão de usuário
  // normal — não são visitas de navegador logado.
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return response;
  }

  // /planos e /bem-vindo fazem parte do fluxo público de assinatura —
  // negócio novo escolhe plano e paga antes de ter conta. /esqueci-senha e
  // /redefinir-senha precisam ser acessíveis sem sessão (é justamente pra
  // quem não consegue entrar).
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/planos") ||
    pathname.startsWith("/bem-vindo") ||
    pathname.startsWith("/convite") ||
    pathname.startsWith("/esqueci-senha") ||
    pathname.startsWith("/redefinir-senha");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

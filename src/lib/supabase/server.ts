import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client — usado em Server Components, Server Actions e Route
// Handlers. Sempre roda com a sessão do usuário logado (nunca service role),
// então toda query aqui já respeita as políticas de RLS do banco.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // chamado de um Server Component — o middleware cuida do refresh
          }
        },
      },
    },
  );
}

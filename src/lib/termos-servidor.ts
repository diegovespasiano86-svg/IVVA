import type { SupabaseClient } from "@supabase/supabase-js";
import { termosDoNegocio, termosDoSegmento, type Termos } from "@/lib/termos";

/** Vocabulário do negócio de quem está logado (paciente, aluno, corretor, visita, aula...). */
export async function carregarTermos(supabase: SupabaseClient): Promise<Termos> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return termosDoSegmento(null);
  const { data } = await supabase.from("users").select("tenants(segmento, termos)").eq("id", user.id).maybeSingle();
  const tenant = data?.tenants as unknown as { segmento: string | null; termos: unknown } | null;
  return termosDoNegocio(tenant?.segmento ?? null, tenant?.termos ?? null);
}

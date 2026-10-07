import type { SupabaseClient } from "@supabase/supabase-js";
import { termosDoSegmento, type Termos } from "@/lib/termos";

/** Vocabulário do negócio de quem está logado (paciente, aluno, corretor, visita, aula...). */
export async function carregarTermos(supabase: SupabaseClient): Promise<Termos> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return termosDoSegmento(null);
  const { data } = await supabase.from("users").select("tenants(segmento)").eq("id", user.id).maybeSingle();
  const segmento = (data?.tenants as unknown as { segmento: string | null } | null)?.segmento ?? null;
  return termosDoSegmento(segmento);
}

import { createClient } from "@/lib/supabase/server";
import { temRecurso, planoMinimoPara, nomePlano } from "@/lib/planos";

/** Plano do negócio logado e se ele tem direito ao diagnóstico mensal do Estúdio. */
export async function acessoEstudio() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role, tenants(plano)").eq("id", user?.id ?? "").maybeSingle();
  const plano = (perfil?.tenants as unknown as { plano: string } | null)?.plano;
  return {
    plano,
    nomeDoPlano: nomePlano(plano),
    temCredito: temRecurso(plano, "estudio_diagnostico"),
    planoMinimo: nomePlano(planoMinimoPara("estudio_diagnostico")),
  };
}

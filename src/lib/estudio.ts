import { createClient } from "@/lib/supabase/server";
import { temRecurso, planoMinimoPara, nomePlano } from "@/lib/planos";

/** Plano do negócio logado e se ele tem direito ao diagnóstico mensal do Estúdio. */
export async function acessoEstudio() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role, tenant_id, tenants(plano)").eq("id", user?.id ?? "").maybeSingle();
  const plano = (perfil?.tenants as unknown as { plano: string } | null)?.plano;
  return {
    plano,
    tenantId: (perfil?.tenant_id as string | null) ?? null,
    nomeDoPlano: nomePlano(plano),
    temCredito: temRecurso(plano, "estudio_diagnostico"),
    planoMinimo: nomePlano(planoMinimoPara("estudio_diagnostico")),
  };
}

/** O negócio já pediu o diagnóstico deste ciclo (últimos 30 dias)? Mesma regra do banco. */
export async function diagnosticoUsadoNoCiclo() {
  const supabase = await createClient();
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count } = await supabase
    .from("estudio_pedidos")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "diagnostico")
    .neq("etapa", "perdido")
    .gte("criado_em", desde);
  return (count ?? 0) > 0;
}

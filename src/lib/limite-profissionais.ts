import type { SupabaseClient } from "@supabase/supabase-js";
import { temRecurso } from "@/lib/planos";

/**
 * Plano Essencial inclui 1 calendário; a partir do Profissional são calendários por profissional.
 * Devolve a mensagem de bloqueio, ou null quando pode cadastrar mais um profissional na agenda.
 * Conta quem já está na agenda e os convites pendentes que também atendem.
 */
export async function bloqueioNovoProfissional(supabase: SupabaseClient, tenantId: string): Promise<string | null> {
  const { data: tenant } = await supabase.from("tenants").select("plano").eq("id", tenantId).maybeSingle();
  if (temRecurso(tenant?.plano, "calendarios_multiplos")) return null;

  const [{ count: naAgenda }, { count: convitesQueAtendem }] = await Promise.all([
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase
      .from("invites")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pendente")
      .eq("atende", true),
  ]);
  if ((naAgenda ?? 0) + (convitesQueAtendem ?? 0) >= 1) {
    return "O plano Essencial inclui 1 calendário. Para ter uma agenda por profissional, faça upgrade para o plano Profissional em Minha assinatura.";
  }
  return null;
}

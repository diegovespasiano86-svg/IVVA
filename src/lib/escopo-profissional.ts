import type { SupabaseClient } from "@supabase/supabase-js";

// Base própria do profissional: os contatos que ele cadastrou (contacts.professional_id) mais os
// que ele já atendeu na agenda. O dono enxerga todos. Este filtro vale para as telas e ações do
// CRM e da agenda; as demais telas de contatos são só do dono (ver nav.ts).

export type Escopo = {
  role: "dono" | "profissional";
  tenantId: string;
  userId: string;
  nome: string;
  /** cadastro de profissional ligado a este usuário (null se ainda não foi ligado) */
  professionalId: string | null;
};

export async function obterEscopo(supabase: SupabaseClient): Promise<Escopo | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role, nome, professional_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return null;

  return {
    role: perfil.role === "profissional" ? "profissional" : "dono",
    tenantId: perfil.tenant_id,
    userId: user.id,
    nome: perfil.nome,
    professionalId: perfil.professional_id ?? null,
  };
}

/** Ids dos contatos que o profissional já atendeu na agenda. */
async function idsAtendidos(supabase: SupabaseClient, professionalId: string): Promise<string[]> {
  const { data } = await supabase
    .from("appointments")
    .select("contact_id")
    .eq("professional_id", professionalId)
    .limit(2000);
  return [...new Set((data ?? []).map((a) => a.contact_id as string).filter(Boolean))];
}

/**
 * Condição PostgREST (para .or()) dos contatos do profissional, ou null se ele não tem
 * cadastro ligado (nesse caso a base dele é vazia). Os ids vêm do próprio banco.
 */
export async function filtroContatosDoProfissional(
  supabase: SupabaseClient,
  professionalId: string,
): Promise<string> {
  const ids = await idsAtendidos(supabase, professionalId);
  return ids.length > 0
    ? `professional_id.eq.${professionalId},id.in.(${ids.join(",")})`
    : `professional_id.eq.${professionalId}`;
}

/** O contato pertence à base deste usuário? (dono: sempre sim) */
export async function contatoNoEscopo(
  supabase: SupabaseClient,
  escopo: Escopo,
  contactId: string,
): Promise<boolean> {
  if (escopo.role === "dono") return true;
  if (!escopo.professionalId) return false;

  const { data: contato } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("tenant_id", escopo.tenantId)
    .eq("professional_id", escopo.professionalId)
    .maybeSingle();
  if (contato) return true;

  const { data: atendimento } = await supabase
    .from("appointments")
    .select("id")
    .eq("contact_id", contactId)
    .eq("professional_id", escopo.professionalId)
    .limit(1)
    .maybeSingle();
  return Boolean(atendimento);
}

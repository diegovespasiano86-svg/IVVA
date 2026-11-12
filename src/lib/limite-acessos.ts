import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANO_LABEL, type PlanoId } from "@/lib/planos";
import { SUPORTE_WHATSAPP_LABEL } from "@/lib/suporte";

/**
 * Quantos acessos (logins) cada plano inclui, contando o dono. Cada acesso tem a sua agenda e pode ser
 * administrador ou usuário (ver acessos.ts). Acima de 5, só falando com a ivva.
 */
export const LIMITE_ACESSOS: Record<PlanoId, number> = {
  essencial: 1,
  profissional: 2,
  completo: 5,
};

export const TEXTO_ACESSOS: Record<PlanoId, string> = {
  essencial: "1 acesso (o seu)",
  profissional: "2 acessos, cada um com a sua agenda",
  completo: "Até 5 acessos, com agendas separadas e controle de administrador ou usuário",
};

export function limiteAcessos(plano: string | null | undefined): number {
  return LIMITE_ACESSOS[(plano as PlanoId) ?? "essencial"] ?? LIMITE_ACESSOS.essencial;
}

function planoOuEssencial(plano: string | null | undefined): PlanoId {
  return plano === "profissional" || plano === "completo" ? plano : "essencial";
}

/** Mensagem de bloqueio quando o plano já está no limite de acessos. */
export function mensagemLimiteAcessos(plano: string | null | undefined): string {
  const p = planoOuEssencial(plano);
  const n = LIMITE_ACESSOS[p];
  if (p === "essencial") {
    return `O plano Essencial inclui ${n} acesso, o seu. Para convidar mais pessoas, mude para o plano Profissional (2 acessos) ou Completo (até 5) em Minha assinatura.`;
  }
  if (p === "profissional") {
    return `O plano Profissional inclui ${n} acessos e todos já estão em uso. Para convidar mais pessoas, mude para o plano Completo (até 5 acessos) em Minha assinatura.`;
  }
  return `O plano ${PLANO_LABEL[p]} inclui até ${n} acessos e todos já estão em uso. Para mais de ${n} acessos, fale com a ivva pelo WhatsApp ${SUPORTE_WHATSAPP_LABEL} ou em contato@ivva.app.br.`;
}

/** Quantos acessos o negócio já usa (pessoas na equipe + convites pendentes), sem contar convites para o e-mail ignorado. */
export async function acessosEmUso(supabase: SupabaseClient, tenantId: string, ignorarEmail?: string): Promise<number> {
  const [{ count: pessoas }, { data: pendentes }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("invites").select("email").eq("tenant_id", tenantId).eq("status", "pendente"),
  ]);
  const ignorar = ignorarEmail?.trim().toLowerCase();
  const convites = (pendentes ?? []).filter((c) => (c.email ?? "").toLowerCase() !== ignorar).length;
  return (pessoas ?? 0) + convites;
}

/** Devolve a mensagem de bloqueio, ou null quando o plano ainda tem acesso livre. */
export async function bloqueioNovoAcesso(supabase: SupabaseClient, tenantId: string, ignorarEmail?: string): Promise<string | null> {
  const { data: tenant } = await supabase.from("tenants").select("plano").eq("id", tenantId).maybeSingle();
  const usados = await acessosEmUso(supabase, tenantId, ignorarEmail);
  if (usados >= limiteAcessos(tenant?.plano)) return mensagemLimiteAcessos(tenant?.plano);
  return null;
}

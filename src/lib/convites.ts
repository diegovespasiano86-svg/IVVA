import type { SupabaseClient } from "@supabase/supabase-js";
import { emailConfigurado, emailConviteProfissional, enviarEmail } from "./email";

export type ResultadoConvite = {
  erro: string | null;
  link: string | null;
  /** true quando o e-mail saiu; false quando só existe o link (envio não configurado ou falhou). */
  emailEnviado: boolean;
  /** Por que o e-mail não saiu (para avisar o dono), quando for o caso. */
  emailMotivo: string | null;
};

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Cria o convite de um profissional e tenta mandar por e-mail. O acesso criado pelo convite é
 * SEMPRE o de profissional (accept_invite no banco), nunca administrador. Chamar só depois de
 * confirmar que quem pede é o dono do negócio.
 *
 * Com professionalId, o convite liga a conta ao profissional já cadastrado; sem ele (fluxo
 * antigo em Conta), o profissional nasce quando o convite é aceito.
 */
export async function criarConviteProfissional(params: {
  supabase: SupabaseClient;
  tenantId: string;
  donoUserId: string;
  nome: string;
  email: string;
  professionalId: string | null;
  origin: string;
}): Promise<ResultadoConvite> {
  const { supabase, tenantId, donoUserId, nome, professionalId, origin } = params;
  const email = params.email.trim().toLowerCase();

  if (!EMAIL_VALIDO.test(email)) {
    return { erro: "Esse e-mail não parece válido.", link: null, emailEnviado: false, emailMotivo: null };
  }

  // Convites antigos pendentes do mesmo profissional ou do mesmo e-mail deixam de valer.
  await supabase
    .from("invites")
    .update({ status: "revogado" })
    .eq("tenant_id", tenantId)
    .eq("status", "pendente")
    .eq("email", email);
  if (professionalId) {
    await supabase
      .from("invites")
      .update({ status: "revogado" })
      .eq("tenant_id", tenantId)
      .eq("status", "pendente")
      .eq("professional_id", professionalId);
  }

  const { data: convite, error } = await supabase
    .from("invites")
    .insert({
      tenant_id: tenantId,
      nome,
      email,
      professional_id: professionalId,
      created_by: donoUserId,
    })
    .select("token")
    .single();

  if (error || !convite) {
    return { erro: "Não consegui criar o convite. Tente de novo.", link: null, emailEnviado: false, emailMotivo: null };
  }

  const link = `${origin}/convite/${convite.token}`;

  const { data: negocio } = await supabase.from("tenants").select("nome").eq("id", tenantId).maybeSingle();
  const modelo = emailConviteProfissional({ nome, negocio: negocio?.nome ?? "seu negócio", link });
  const envio = await enviarEmail({ para: email, assunto: modelo.assunto, html: modelo.html, texto: modelo.texto });

  return {
    erro: null,
    link,
    emailEnviado: envio.ok,
    emailMotivo: envio.ok ? null : (envio.motivo ?? (emailConfigurado() ? "o envio do e-mail falhou" : null)),
  };
}

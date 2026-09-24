"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createBillingPortalSession, cancelarAssinaturasAtivas } from "@/lib/stripe";
import {
  exchangeEmbeddedSignupCode,
  buscarDetalhesNumero,
  solicitarSincronizacaoCoexistencia,
  WhatsAppEmbeddedSignupError,
} from "@/lib/whatsapp-embedded-signup";

export async function conectarWhatsApp(
  _prevState: string | undefined,
  formData: FormData,
) {
  const phoneNumberId = String(formData.get("phone_number_id") ?? "").trim();
  const businessAccountId = String(
    formData.get("business_account_id") ?? "",
  ).trim();
  const accessToken = String(formData.get("access_token") ?? "").trim();
  const displayNumber = String(formData.get("display_phone_number") ?? "").trim();

  if (!phoneNumberId || !accessToken) {
    return "Preencha ao menos o Phone Number ID e o token de acesso.";
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sessão expirada, faça login de novo.";

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || perfil.role !== "dono") {
    return "Só o dono do negócio pode conectar o WhatsApp.";
  }

  const { error: upsertError } = await supabase
    .from("whatsapp_accounts")
    .upsert(
      {
        tenant_id: perfil.tenant_id,
        phone_number_id: phoneNumberId,
        business_account_id: businessAccountId || null,
        display_phone_number: displayNumber || null,
        status: "ativo",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );

  if (upsertError) {
    // unique_violation no phone_number_id: esse número já está conectado
    // em outro negócio na ivva — não pode roteirar pra dois tenants.
    if (upsertError.code === "23505") {
      return "Esse Phone Number ID já está conectado em outro negócio na ivva.";
    }
    return "Não consegui salvar. Confere os dados e tenta de novo.";
  }

  // Token fica cifrado no Vault, nunca em texto puro na tabela — ver
  // migração encrypt_whatsapp_access_token.
  const internalSecret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!internalSecret) {
    return "Configuração interna ausente — fale com o suporte.";
  }
  const { error: tokenError } = await supabase.rpc("whatsapp_set_token", {
    p_secret: internalSecret,
    p_tenant_id: perfil.tenant_id,
    p_access_token: accessToken,
  });
  if (tokenError) {
    return "Não consegui salvar o token com segurança. Tenta de novo.";
  }

  revalidatePath("/conta");
  return undefined;
}

// Fluxo novo (Embedded Signup / Coexistência): o dono loga pelo popup da
// Meta com o número que já usa no WhatsApp Business app — sem precisar
// criar conta de desenvolvedor, copiar Phone Number ID nem gerar token na
// mão. O front manda o código do login + os IDs que a Meta devolveu pelo
// evento da janela; aqui só troca o código pelo token e salva.
export async function conectarWhatsAppEmbedded(params: {
  code: string;
  phoneNumberId: string;
  wabaId: string;
  isCoexistence: boolean;
}): Promise<{ erro: string | null }> {
  const { code, phoneNumberId, wabaId, isCoexistence } = params;

  if (!code || !phoneNumberId || !wabaId) {
    return { erro: "Dados incompletos vindos do login com a Meta. Tenta de novo." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada, faça login de novo." };

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || perfil.role !== "dono") {
    return { erro: "Só o dono do negócio pode conectar o WhatsApp." };
  }

  let accessToken: string;
  try {
    accessToken = await exchangeEmbeddedSignupCode(code);
  } catch (err) {
    return {
      erro:
        err instanceof WhatsAppEmbeddedSignupError
          ? err.message
          : "Falha ao concluir o login com a Meta. Tenta de novo.",
    };
  }

  const { displayPhoneNumber } = await buscarDetalhesNumero(phoneNumberId, accessToken);

  const { error: upsertError } = await supabase
    .from("whatsapp_accounts")
    .upsert(
      {
        tenant_id: perfil.tenant_id,
        phone_number_id: phoneNumberId,
        business_account_id: wabaId,
        display_phone_number: displayPhoneNumber,
        status: "ativo",
        is_coexistence: isCoexistence,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );

  if (upsertError) {
    if (upsertError.code === "23505") {
      return { erro: "Esse número já está conectado em outro negócio na ivva." };
    }
    return { erro: "Não consegui salvar. Tenta de novo." };
  }

  const internalSecret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!internalSecret) {
    return { erro: "Configuração interna ausente — fale com o suporte." };
  }
  const { error: tokenError } = await supabase.rpc("whatsapp_set_token", {
    p_secret: internalSecret,
    p_tenant_id: perfil.tenant_id,
    p_access_token: accessToken,
  });
  if (tokenError) {
    return { erro: "Não consegui salvar o token com segurança. Tenta de novo." };
  }

  // Só faz sentido pedir sincronização de histórico quando o número já
  // existia no WhatsApp Business app (Coexistência) — número novo não tem
  // o que sincronizar.
  if (isCoexistence) {
    await solicitarSincronizacaoCoexistencia(phoneNumberId, accessToken);
  }

  revalidatePath("/conta");
  return { erro: null };
}

export async function pedirAjudaWhatsApp(formData: FormData) {
  const mensagem = String(formData.get("mensagem") ?? "").trim();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return;

  await supabase.from("help_requests").insert({
    tenant_id: perfil.tenant_id,
    user_id: user.id,
    assunto: "Conectar WhatsApp Business",
    mensagem: mensagem || null,
  });

  revalidatePath("/conta");
}

export async function criarConvite(
  _prevState: { erro: string | null; link: string | null },
  formData: FormData,
) {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!nome || !email) {
    return { erro: "Preencha nome e e-mail.", link: null };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada, faça login de novo.", link: null };

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || perfil.role !== "dono") {
    return { erro: "Só o dono do negócio pode convidar profissionais.", link: null };
  }

  const { data: convite, error } = await supabase
    .from("invites")
    .insert({
      tenant_id: perfil.tenant_id,
      nome,
      email,
      created_by: user.id,
    })
    .select("token")
    .single();

  if (error || !convite) {
    return { erro: "Não consegui criar o convite. Tenta de novo.", link: null };
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `https://${headerList.get("host") ?? "localhost:3000"}`;

  revalidatePath("/conta");
  return { erro: null, link: `${origin}/convite/${convite.token}` };
}

export async function revogarConvite(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("invites").update({ status: "revogado" }).eq("id", id);

  revalidatePath("/conta");
}

export async function desconectarWhatsApp() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return;

  await supabase
    .from("whatsapp_accounts")
    .delete()
    .eq("tenant_id", perfil.tenant_id);

  revalidatePath("/conta");
}

// Manda o dono pro portal de cobrança hospedado pela própria Stripe — lá
// ele troca de plano, atualiza cartão/Pix e vê faturas. A gente nunca
// toca em dado de pagamento; só sabe o resultado quando ele volta.
export async function abrirPortalCobranca(
  _prevState: string | undefined,
): Promise<string | undefined> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sessão expirada, faça login de novo.";

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || perfil.role !== "dono") {
    return "Só o dono do negócio pode gerenciar a assinatura.";
  }

  const { data: assinatura } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", perfil.tenant_id)
    .maybeSingle();

  if (!assinatura?.stripe_customer_id) {
    return "Ainda não encontramos sua cobrança na Stripe. Fale com a gente.";
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `https://${headerList.get("host") ?? "localhost:3000"}`;

  let session;
  try {
    session = await createBillingPortalSession({
      customerId: assinatura.stripe_customer_id,
      returnUrl: `${origin}/conta`,
    });
  } catch (err) {
    return err instanceof Error ? err.message : "Falha ao abrir o portal de cobrança.";
  }

  redirect(session.url);
}

// Apagar conta — encerra tudo de uma vez: cancela a assinatura na Stripe
// (senão o dono continua sendo cobrado com os dados já apagados), apaga
// o tenant inteiro em cascata via excluir_conta_lgpd (contatos, conversas,
// mensagens, agenda, base de conhecimento, WhatsApp) e desloga.
// Exige reautenticação por senha + digitar o nome do negócio, igual a
// fluxos de exclusão de conta do Instagram/Google — dupla confirmação
// numa ação irreversível.
export async function excluirConta(
  _prevState: { erro: string | null },
  formData: FormData,
): Promise<{ erro: string | null }> {
  const nomeDigitado = String(formData.get("nome_confirmacao") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!senha) {
    return { erro: "Digite sua senha pra confirmar." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login de novo." };

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role, tenants(nome)")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || perfil.role !== "dono") {
    return { erro: "Só o dono do negócio pode apagar a conta." };
  }

  const tenantNome = (perfil.tenants as unknown as { nome: string } | null)?.nome ?? "";
  if (nomeDigitado !== tenantNome.trim()) {
    return { erro: "O nome digitado não confere com o nome do negócio." };
  }

  // Reautentica pra confirmar que é mesmo o dono digitando, não uma sessão
  // esquecida aberta em outro computador.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: senha,
  });
  if (authError) {
    return { erro: "Senha incorreta." };
  }

  const { data: assinatura } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", perfil.tenant_id)
    .maybeSingle();

  if (assinatura?.stripe_customer_id) {
    try {
      await cancelarAssinaturasAtivas(assinatura.stripe_customer_id);
    } catch {
      return {
        erro:
          "Não consegui cancelar sua assinatura na Stripe agora. Tenta de novo em instantes, ou fale com a gente.",
      };
    }
  }

  const { error: excluirError } = await supabase.rpc("excluir_conta_lgpd");
  if (excluirError) {
    return { erro: "Não consegui apagar a conta agora. Tenta de novo ou fale com a gente." };
  }

  await supabase.auth.signOut();
  redirect("/login?conta_apagada=1");
}

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hashPin } from "@/lib/pin";

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
        access_token: accessToken,
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

  revalidatePath("/conta");
  return undefined;
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

export async function atualizarIdentidadeAssistente(
  _prevState: string | undefined,
  formData: FormData,
) {
  const nomeAssistente = String(formData.get("nome_assistente") ?? "").trim();
  const tom = String(formData.get("tom") ?? "").trim();
  const horarioAtendimento = String(formData.get("horario_atendimento") ?? "").trim();
  const regrasTexto = String(formData.get("regras") ?? "");
  const regras = regrasTexto
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);

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
    return "Só o dono do negócio pode configurar o atendimento.";
  }

  const { error } = await supabase
    .from("tenants")
    .update({
      identidade_assistente: {
        nome_assistente: nomeAssistente || undefined,
        tom: tom || undefined,
        horario_atendimento: horarioAtendimento || undefined,
        regras,
      },
    })
    .eq("id", perfil.tenant_id);

  if (error) {
    return "Não consegui salvar. Tenta de novo.";
  }

  revalidatePath("/conta");
  return undefined;
}

export async function atualizarBotSettings(
  _prevState: string | undefined,
  formData: FormData,
) {
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
    return "Só o dono do negócio pode configurar isso.";
  }

  const posVendaDelay = String(formData.get("pos_venda_delay") ?? "1d");
  const novoPin = String(formData.get("admin_pin") ?? "").trim();

  if (novoPin && !/^\d{4,6}$/.test(novoPin)) {
    return "O PIN precisa ter de 4 a 6 dígitos numéricos.";
  }

  const dados: Record<string, unknown> = {
    tenant_id: perfil.tenant_id,
    pos_venda_ativo: formData.get("pos_venda_ativo") === "on",
    pos_venda_delay: posVendaDelay,
    pos_venda_mensagem: String(formData.get("pos_venda_mensagem") ?? "").trim() || null,
    pedir_instagram_primeiro_contato: formData.get("pedir_instagram_primeiro_contato") === "on",
    pedir_email_primeiro_contato: formData.get("pedir_email_primeiro_contato") === "on",
    reengajamento_ativo: formData.get("reengajamento_ativo") === "on",
    reengajamento_dias_inatividade: Number(formData.get("reengajamento_dias_inatividade") ?? 60) || 60,
    link_avaliacao_google: String(formData.get("link_avaliacao_google") ?? "").trim() || null,
    aniversario_ativo: formData.get("aniversario_ativo") === "on",
    aniversario_dias_antecedencia: Number(formData.get("aniversario_dias_antecedencia") ?? 0) || 0,
    aniversario_mensagem: String(formData.get("aniversario_mensagem") ?? "").trim() || null,
    admin_whatsapp_numero: String(formData.get("admin_whatsapp_numero") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  // PIN só é trocado se o dono digitou um novo — campo fica sempre vazio
  // na tela (nunca mostramos o PIN salvo de volta).
  if (novoPin) {
    dados.admin_pin_hash = hashPin(novoPin);
  }

  const { error } = await supabase
    .from("bot_settings")
    .upsert(dados, { onConflict: "tenant_id" });

  if (error) {
    return "Não consegui salvar. Tenta de novo.";
  }

  revalidatePath("/conta");
  return undefined;
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

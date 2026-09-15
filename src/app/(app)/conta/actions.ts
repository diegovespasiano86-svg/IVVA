"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    return "Não consegui salvar. Confere os dados e tenta de novo.";
  }

  // Mantém tenants.whatsapp_number_id em sincronia — é essa coluna que
  // o webhook usa pra descobrir de qual negócio é a mensagem recebida.
  await supabase
    .from("tenants")
    .update({ whatsapp_number_id: phoneNumberId })
    .eq("id", perfil.tenant_id);

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

  await supabase
    .from("tenants")
    .update({ whatsapp_number_id: null })
    .eq("id", perfil.tenant_id);

  revalidatePath("/conta");
}

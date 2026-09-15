"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarTarefa(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const motivo = String(formData.get("motivo") ?? "");
  const mensagem = String(formData.get("mensagem_enviada") ?? "").trim();

  if (!contactId || !motivo) return;

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

  await supabase.from("outreach_tasks").insert({
    tenant_id: perfil.tenant_id,
    contact_id: contactId,
    motivo,
    mensagem_enviada: mensagem || null,
    status: "pendente",
  });

  revalidatePath("/tarefas");
}

export async function atualizarStatusTarefa(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return;

  const supabase = await createClient();
  await supabase.from("outreach_tasks").update({ status }).eq("id", id);

  revalidatePath("/tarefas");
}

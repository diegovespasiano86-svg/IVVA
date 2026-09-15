"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarAgendamento(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const professionalId = String(formData.get("professional_id") ?? "");
  const dataHora = String(formData.get("data_hora") ?? "");

  if (!contactId || !professionalId || !dataHora) return;

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

  await supabase.from("appointments").insert({
    tenant_id: perfil.tenant_id,
    contact_id: contactId,
    professional_id: professionalId,
    data_hora: new Date(dataHora).toISOString(),
    status: "agendado",
  });

  revalidatePath("/calendario");
  revalidatePath("/dashboard");
}

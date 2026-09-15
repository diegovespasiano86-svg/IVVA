"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarEntrada(formData: FormData) {
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!conteudo) return;

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

  await supabase.from("knowledge_base").insert({
    tenant_id: perfil.tenant_id,
    tipo: "texto",
    conteudo,
  });

  revalidatePath("/base-conhecimento");
}

export async function removerEntrada(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("knowledge_base").delete().eq("id", id);

  revalidatePath("/base-conhecimento");
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarContato(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();

  if (!nome || !telefone) return;

  const supabase = await createClient();

  // tenant_id vem do próprio usuário logado, via current_tenant_id() no RLS —
  // mas o INSERT ainda precisa do valor explícito na linha.
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

  await supabase.from("contacts").insert({
    tenant_id: perfil.tenant_id,
    nome,
    telefone,
    status_funil: "sem_contato",
  });

  revalidatePath("/crm");
  revalidatePath("/calendario");
}

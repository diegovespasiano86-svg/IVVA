"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CONTRATO_VERSAO } from "@/lib/contrato";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Registra o aceite da versão atual do contrato (popup obrigatório do primeiro acesso). */
export async function aceitarContrato(_prev: { erro: string | null }, form: FormData): Promise<{ erro: string | null }> {
  if (form.get("concordo") !== "on") return { erro: "Marque a caixa de aceite para continuar." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  const h = await headers();
  const { error } = await supabase.from("contrato_aceites").insert({
    user_id: user.id,
    tenant_id: perfil?.tenant_id ?? null,
    versao: CONTRATO_VERSAO,
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    user_agent: h.get("user-agent")?.slice(0, 400) ?? null,
  });
  // 23505 = já aceitou esta versão (clique duplo ou outra aba): segue normalmente.
  if (error && error.code !== "23505") {
    console.error("[contrato] falha ao registrar o aceite", error);
    return { erro: "Não consegui registrar o aceite. Tente de novo em instantes." };
  }
  revalidatePath("/", "layout");
  return { erro: null };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ChaveState = { chave: string | null; erro: string | null };

export async function criarChave(_prev: ChaveState, formData: FormData): Promise<ChaveState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("api_chave_criar", { p_nome: String(formData.get("nome") ?? "") });
  if (error) return { chave: null, erro: /limite/.test(error.message) ? "Você já tem 5 chaves ativas. Revogue uma para criar outra." : "Não foi possível criar a chave." };
  revalidatePath("/integracoes");
  return { chave: data as string, erro: null };
}

export async function revogarChave(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("api_chave_revogar", { p_id: String(formData.get("id") ?? "") });
  revalidatePath("/integracoes");
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Liga ou desliga o link público do robô (só o dono; a função do banco confere o papel). */
export async function definirLinkPublico(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("robo_publico_definir", { p_ativo: formData.get("ativo") === "1" });
  revalidatePath("/robo");
}

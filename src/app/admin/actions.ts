"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function resolverChamado(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.rpc("admin_resolver_chamado", { p_chamado_id: id });

  revalidatePath("/admin");
}

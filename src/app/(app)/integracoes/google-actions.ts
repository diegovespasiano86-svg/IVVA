"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sincronizarGoogleAgenda } from "@/lib/google-agenda";

async function usuario() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  return perfil ? { supabase, userId: user.id, tenantId: perfil.tenant_id as string } : null;
}

export async function desconectarGoogleAgenda() {
  const u = await usuario();
  if (!u) return;
  // Os eventos já criados continuam na agenda do Google; só para de sincronizar.
  await u.supabase.from("google_agenda_conexoes").delete().eq("user_id", u.userId);
  revalidatePath("/integracoes");
}

export async function alternarConvidarCliente(formData: FormData) {
  const u = await usuario();
  if (!u) return;
  const ligar = formData.get("ligar") === "1";
  await u.supabase.from("google_agenda_conexoes").update({ convidar_cliente: ligar }).eq("user_id", u.userId);
  revalidatePath("/integracoes");
}

export async function sincronizarAgoraGoogle() {
  const u = await usuario();
  if (!u) return;
  await sincronizarGoogleAgenda(u.tenantId);
  revalidatePath("/integracoes");
}

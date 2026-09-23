"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Alguém no plano Essencial clicou em "Pedir demonstração" numa seção
// bloqueada (dashboard, estoque, etc). Isso vira um chamado normal pro
// dono ver em Conta > Seus chamados — e é justamente o ponto de contato
// que gera oportunidade de upsell.
export async function solicitarDemonstracao(formData: FormData) {
  const recurso = String(formData.get("recurso") ?? "").trim();
  if (!recurso) return;

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
    assunto: `Quer conhecer: ${recurso}`,
    mensagem: `Clicou em "Pedir demonstração" na seção bloqueada de ${recurso}.`,
  });

  revalidatePath("/", "layout");
}

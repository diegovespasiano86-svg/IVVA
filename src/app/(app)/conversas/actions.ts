"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppText } from "@/lib/whatsapp";

export async function responderConversa(
  _prevState: { erro: string | null },
  formData: FormData,
) {
  const conversationId = String(formData.get("conversation_id") ?? "");
  const telefone = String(formData.get("telefone") ?? "");
  const conteudo = String(formData.get("conteudo") ?? "").trim();

  if (!conversationId || !telefone || !conteudo) {
    return { erro: "Preencha a mensagem." };
  }

  const supabase = await createClient();

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .maybeSingle();

  const { data: conta } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("tenant_id", perfil?.tenant_id ?? "")
    .maybeSingle();

  if (!conta) {
    return { erro: "WhatsApp ainda não conectado. Vá em Conta e assinatura." };
  }

  try {
    await sendWhatsAppText(
      { phoneNumberId: conta.phone_number_id, token: conta.access_token },
      telefone,
      conteudo,
    );
  } catch (err) {
    return {
      erro:
        err instanceof Error
          ? err.message
          : "Falha ao enviar pelo WhatsApp.",
    };
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    remetente: "humano",
    conteudo,
  });

  await supabase
    .from("conversations")
    .update({ status: "humano" })
    .eq("id", conversationId);

  revalidatePath("/conversas");
  return { erro: null };
}

export async function encerrarConversa(formData: FormData) {
  const conversationId = String(formData.get("conversation_id") ?? "");
  if (!conversationId) return;

  const supabase = await createClient();
  await supabase
    .from("conversations")
    .update({ status: "encerrada" })
    .eq("id", conversationId);

  revalidatePath("/conversas");
}

// Devolve a conversa pro robô — usado quando a IA pediu handoff (ou um
// humano assumiu) e o dono quer que o bot volte a responder sozinho, sem
// precisar mexer no banco na mão.
export async function restaurarBot(formData: FormData) {
  const conversationId = String(formData.get("conversation_id") ?? "");
  if (!conversationId) return;

  const supabase = await createClient();
  await supabase
    .from("conversations")
    .update({ status: "bot", handoff_motivo: null })
    .eq("id", conversationId);

  revalidatePath("/conversas");
}

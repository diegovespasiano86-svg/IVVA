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

  try {
    await sendWhatsAppText(telefone, conteudo);
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

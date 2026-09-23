"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { sugerirFatoConhecimento } from "@/lib/sugestao-conhecimento";

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

  // Token nunca é lido em texto puro da tabela — a RPC decifra do Vault e
  // já vem tenant-scoped pelo auth.uid() da sessão (não recebe tenant_id
  // por parâmetro, então não dá pra pedir o token de outro negócio).
  const { data: contas } = await supabase.rpc("whatsapp_conta_atual");
  const conta = contas?.[0];

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
  revalidatePath(`/conversas/${conversationId}`);
  revalidatePath("/sac");
  return { erro: null };
}

export async function encerrarConversa(formData: FormData) {
  const conversationId = String(formData.get("conversation_id") ?? "");
  if (!conversationId) return;

  const supabase = await createClient();

  const { data: conversa } = await supabase
    .from("conversations")
    .select("tenant_id, handoff_motivo")
    .eq("id", conversationId)
    .maybeSingle();

  await supabase
    .from("conversations")
    .update({ status: "encerrada", handoff_em: null })
    .eq("id", conversationId);

  // Só tenta aprender quando o ticket veio de um handoff de verdade (robô
  // pediu ajuda) — encerrar uma conversa qualquer não gera sugestão.
  // Falha aqui nunca impede o encerramento, que já aconteceu acima.
  if (conversa?.handoff_motivo) {
    try {
      await gerarSugestaoDaConversa(supabase, conversationId, conversa.tenant_id);
    } catch (err) {
      console.error("[conversas] falha ao gerar sugestão de conhecimento", err);
    }
  }

  revalidatePath("/conversas");
  revalidatePath(`/conversas/${conversationId}`);
  revalidatePath("/sac");
}

async function gerarSugestaoDaConversa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  tenantId: string,
) {
  const { data: mensagens } = await supabase
    .from("messages")
    .select("remetente, conteudo, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);

  const semHumano = !(mensagens ?? []).some((m) => m.remetente === "humano");
  if (semHumano) return; // ninguém respondeu ainda — nada pra aprender

  const transcript = (mensagens ?? [])
    .map((m) => {
      const quem = m.remetente === "contato" ? "Cliente" : m.remetente === "humano" ? "Atendente" : "Robô";
      return `${quem}: ${m.conteudo}`;
    })
    .join("\n");

  const sugestao = await sugerirFatoConhecimento(transcript);
  if (!sugestao?.temFato || !sugestao.fato) return;

  await supabase.from("knowledge_base_sugestoes").insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    pergunta_cliente: sugestao.perguntaCliente || null,
    conteudo_sugerido: sugestao.fato,
  });
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
    .update({ status: "bot", handoff_motivo: null, handoff_em: null })
    .eq("id", conversationId);

  revalidatePath("/conversas");
  revalidatePath(`/conversas/${conversationId}`);
  revalidatePath("/sac");
}

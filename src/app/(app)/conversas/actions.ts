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
  const conteudo = String(formData.get("conteudo") ?? "").trim().slice(0, 4000);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId) || !conteudo) {
    return { erro: "Preencha a mensagem." };
  }

  const supabase = await createClient();

  // O telefone vem da PRÓPRIA conversa (a RLS garante que é do seu negócio).
  // Nunca do formulário: senão qualquer usuário mandaria mensagem pelo número
  // do negócio para qualquer telefone.
  const { data: conversa } = await supabase
    .from("conversations")
    .select("id, status, contacts(telefone)")
    .eq("id", conversationId)
    .maybeSingle();
  const telefone = (conversa?.contacts as unknown as { telefone: string } | null)?.telefone;
  if (!conversa || !telefone) return { erro: "Conversa não encontrada." };
  if (conversa.status === "encerrada") return { erro: "Essa conversa já foi encerrada." };

  // O token só sai do banco para o SERVIDOR: a função exige o segredo interno e a
  // sessão do usuário define o negócio (não dá para pedir o token de outro).
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return { erro: "Configuração do servidor incompleta. Fale com a gente." };
  const { data: contas } = await supabase.rpc("whatsapp_conta_atual_srv", { p_secret: secret });
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

// ---- Modo "sugerir e aprovar" ------------------------------------------------
// O robô deixa a resposta como rascunho; ela só vai ao cliente quando o dono aprova (podendo editar).
// A conversa continua com o robô (não vira atendimento humano), então o próximo rascunho vem sozinho.

export async function aprovarRascunho(
  _prev: { erro: string | null },
  formData: FormData,
): Promise<{ erro: string | null }> {
  const rascunhoId = String(formData.get("rascunho_id") ?? "");
  const conteudo = String(formData.get("conteudo") ?? "").trim().slice(0, 4000);
  if (!/^[0-9a-f-]{36}$/i.test(rascunhoId) || !conteudo) return { erro: "Escreva a mensagem antes de enviar." };

  const supabase = await createClient();
  const { data: r } = await supabase
    .from("conversation_rascunhos")
    .select("id, status, fontes, conversation_id, conversations(status, contacts(telefone))")
    .eq("id", rascunhoId)
    .maybeSingle();
  if (!r || r.status !== "pendente") return { erro: "Esse rascunho não está mais disponível." };
  const conv = r.conversations as unknown as { status: string; contacts: { telefone: string } | null } | null;
  const telefone = conv?.contacts?.telefone;
  if (!telefone) return { erro: "Conversa não encontrada." };
  if (conv?.status === "encerrada") return { erro: "Essa conversa já foi encerrada." };

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return { erro: "Configuração do servidor incompleta. Fale com a gente." };
  const { data: contas } = await supabase.rpc("whatsapp_conta_atual_srv", { p_secret: secret });
  const conta = contas?.[0];
  if (!conta) return { erro: "WhatsApp ainda não conectado. Vá em Conta e assinatura." };

  try {
    await sendWhatsAppText({ phoneNumberId: conta.phone_number_id, token: conta.access_token }, telefone, conteudo);
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Falha ao enviar pelo WhatsApp." };
  }

  await supabase.from("messages").insert({
    conversation_id: r.conversation_id,
    remetente: "bot",
    conteudo,
    fontes: Array.isArray(r.fontes) && r.fontes.length > 0 ? r.fontes : null,
  });
  await supabase.from("conversation_rascunhos").update({ status: "enviado" }).eq("id", rascunhoId);

  revalidatePath("/conversas");
  revalidatePath(`/conversas/${r.conversation_id}`);
  return { erro: null };
}

export async function descartarRascunho(formData: FormData) {
  const rascunhoId = String(formData.get("rascunho_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(rascunhoId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_rascunhos")
    .update({ status: "descartado" })
    .eq("id", rascunhoId)
    .eq("status", "pendente")
    .select("conversation_id")
    .maybeSingle();
  if (data) revalidatePath(`/conversas/${data.conversation_id}`);
}

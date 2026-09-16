import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { gerarRespostaWhatsApp, type ContextoConversa } from "@/lib/ai";

// Verificação inicial do webhook — a Meta chama essa rota com um GET pra
// confirmar que o endpoint é nosso antes de ativar o recebimento de eventos.
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// A Meta assina todo POST com HMAC-SHA256 do corpo bruto, usando o App
// Secret. Sem checar isso, qualquer um que descobrisse essa URL conseguiria
// injetar mensagens falsas em qualquer conversa de qualquer tenant.
function assinaturaValida(rawBody: string, assinaturaHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("[whatsapp webhook] WHATSAPP_APP_SECRET não configurado — recusando por segurança");
    return false;
  }
  if (!assinaturaHeader?.startsWith("sha256=")) return false;

  const esperada = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const recebida = assinaturaHeader.slice("sha256=".length);

  const a = Buffer.from(esperada, "hex");
  const b = Buffer.from(recebida, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type WhatsAppWebhookBody = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: { id?: string; from?: string; text?: { body?: string }; type?: string }[];
      };
    }[];
  }[];
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!assinaturaValida(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body: WhatsAppWebhookBody = JSON.parse(rawBody);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const internalSecret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;

  if (!internalSecret) {
    console.error("[whatsapp webhook] WHATSAPP_WEBHOOK_INTERNAL_SECRET não configurado");
    return NextResponse.json({ received: true });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      for (const msg of value?.messages ?? []) {
        if (msg.type !== "text" || !msg.from) continue;
        const contactName = value?.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;

        try {
          await processarMensagem({
            supabaseUrl,
            anonKey,
            internalSecret,
            phoneNumberId,
            waId: msg.from,
            waMessageId: msg.id ?? null,
            contactName: contactName ?? null,
            content: msg.text?.body ?? "",
          });
        } catch (err) {
          // Uma falha (IA fora do ar, erro de rede) não pode derrubar o
          // webhook inteiro nem travar as outras mensagens do lote.
          console.error("[whatsapp webhook] falha ao processar mensagem", err);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}

async function processarMensagem(params: {
  supabaseUrl: string;
  anonKey: string;
  internalSecret: string;
  phoneNumberId: string;
  waId: string;
  waMessageId: string | null;
  contactName: string | null;
  content: string;
}) {
  const { supabaseUrl, anonKey, internalSecret, phoneNumberId, waId, waMessageId, contactName, content } = params;
  const supabase = createClient(supabaseUrl, anonKey);

  const { data, error } = await supabase.rpc("handle_inbound_whatsapp_message", {
    p_secret: internalSecret,
    p_phone_number_id: phoneNumberId,
    p_wa_id: waId,
    p_wa_message_id: waMessageId,
    p_contact_name: contactName,
    p_content: content,
  });

  if (error) {
    console.error("[whatsapp webhook] erro no handle_inbound_whatsapp_message", error);
    return;
  }

  const resultado = data as {
    erro?: string;
    tenant_id: string;
    tenant_nome: string;
    identidade_assistente: ContextoConversa["identidadeAssistente"];
    horario_abertura: string | null;
    horario_fechamento: string | null;
    conversation_id: string;
    conversation_status: string;
    contact_id: string;
    contact_nome: string;
    contact_is_novo: boolean;
    whatsapp_phone_number_id: string;
    whatsapp_access_token: string;
    historico: { remetente: "contato" | "bot" | "humano"; conteudo: string }[];
    profissionais: { id: string; nome: string }[];
  };

  if (resultado?.erro) {
    // "tenant_nao_encontrado": número não está conectado a nenhum negócio —
    // "ja_processada": reentrega da Meta pro mesmo evento (idempotência).
    return;
  }

  // Conversa já está com um humano — a IA não responde, o dono/equipe
  // responde manualmente pelo /conversas.
  if (resultado.conversation_status !== "bot") return;

  const creds = { phoneNumberId: resultado.whatsapp_phone_number_id, token: resultado.whatsapp_access_token };

  const ctx: ContextoConversa = {
    tenantId: resultado.tenant_id,
    tenantNome: resultado.tenant_nome,
    identidadeAssistente: resultado.identidade_assistente,
    conversationId: resultado.conversation_id,
    contactId: resultado.contact_id,
    contactNome: resultado.contact_nome,
    contactIsNovo: resultado.contact_is_novo,
    historico: resultado.historico,
    profissionais: resultado.profissionais ?? [],
    horarioAbertura: resultado.horario_abertura,
    horarioFechamento: resultado.horario_fechamento,
  };

  let resposta: string;
  try {
    const resultadoIA = await gerarRespostaWhatsApp(ctx, internalSecret, supabaseUrl, anonKey);
    resposta = resultadoIA.resposta;
  } catch (err) {
    console.error("[whatsapp webhook] falha na IA — caindo pra handoff automático", err);
    resposta = "Peço desculpa, tive um probleminha aqui. Já chamei alguém da equipe pra te ajudar.";
    await supabase.rpc("ia_solicitar_handoff", {
      p_secret: internalSecret,
      p_conversation_id: resultado.conversation_id,
      p_tenant_id: resultado.tenant_id,
      p_motivo: "Falha técnica ao gerar resposta da IA",
    });
  }

  // Antes, uma falha aqui (token vencido, rate limit etc.) sumia sem
  // ninguém saber — cliente sem resposta, dono sem aviso. Agora qualquer
  // falha de envio abre um help_request pro dono e marca a conta em erro
  // (visível no dashboard/sidebar); um envio bem-sucedido depois disso
  // limpa esse estado sozinho.
  let envio: { messages?: { id?: string }[] } | undefined;
  try {
    envio = await sendWhatsAppText(creds, waId, resposta);
  } catch (err) {
    console.error("[whatsapp webhook] falha ao ENVIAR resposta pro WhatsApp", err);
    await supabase.rpc("record_whatsapp_send_failure", {
      p_secret: internalSecret,
      p_tenant_id: resultado.tenant_id,
      p_erro: err instanceof Error ? err.message : "Falha desconhecida ao enviar mensagem",
    });
    return;
  }

  await supabase.rpc("record_whatsapp_send_success", {
    p_secret: internalSecret,
    p_tenant_id: resultado.tenant_id,
  });

  await supabase.rpc("record_bot_reply", {
    p_secret: internalSecret,
    p_conversation_id: resultado.conversation_id,
    p_conteudo: resposta,
    p_wa_message_id: envio?.messages?.[0]?.id ?? null,
  });
}

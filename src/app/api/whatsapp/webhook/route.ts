import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  sendWhatsAppText,
  sendWhatsAppInteractiveList,
  baixarMidiaWhatsApp,
  type WhatsAppCreds,
} from "@/lib/whatsapp";
import { gerarRespostaWhatsApp, type ContextoConversa, type ResultadoIA } from "@/lib/ai";
import { gerarRespostaAdmin } from "@/lib/admin-ai";
import { verifyPin } from "@/lib/pin";
import { transcreverAudio } from "@/lib/transcricao";

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
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
          interactive?: {
            type?: string;
            list_reply?: { id?: string; title?: string };
            button_reply?: { id?: string; title?: string };
          };
          image?: { id?: string; mime_type?: string; caption?: string };
          audio?: { id?: string; mime_type?: string };
        }[];
        // account_update (Coexistência): evento de conexão/desconexão da
        // conta — não tem metadata.phone_number_id, o número vem direto
        // no campo phone_number.
        event?: string;
        phone_number?: string;
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

      // Coexistência: conexão/desconexão da conta (ex: dono desliga pelo
      // próprio app do WhatsApp Business) e sincronização de contatos e
      // histórico. Cada um tem formato próprio — trata à parte e não cai
      // no fluxo de mensagem normal abaixo.
      if (change.field === "account_update") {
        await processarAccountUpdate({ supabaseUrl, anonKey, internalSecret, value: value ?? {} });
        continue;
      }
      if (
        change.field === "history" ||
        change.field === "smb_app_state_sync" ||
        change.field === "smb_message_echoes"
      ) {
        const phoneNumberIdSync = value?.metadata?.phone_number_id;
        if (phoneNumberIdSync) {
          await registrarSyncEvent({
            supabaseUrl,
            anonKey,
            internalSecret,
            phoneNumberId: phoneNumberIdSync,
            field: change.field,
            payload: value,
          });
        }
        continue;
      }

      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      for (const msg of value?.messages ?? []) {
        if (!msg.from) continue;

        // Mensagem de texto normal, lista/botão interativo, áudio (vira
        // texto transcrito) ou imagem (vai como anexo multimodal pra IA).
        let content: string | null = null;
        let botaoId: string | null = null;
        let midia: { id: string; mimeType: string; tipo: "image" | "audio" } | null = null;

        if (msg.type === "text") {
          content = msg.text?.body ?? "";
        } else if (msg.type === "interactive") {
          const reply = msg.interactive?.list_reply ?? msg.interactive?.button_reply;
          if (reply?.title) content = `Escolho: ${reply.title}`;
          botaoId = msg.interactive?.button_reply?.id ?? null;
        } else if (msg.type === "image" && msg.image?.id) {
          content = msg.image.caption?.trim() || "[imagem]";
          midia = { id: msg.image.id, mimeType: msg.image.mime_type ?? "image/jpeg", tipo: "image" };
        } else if (msg.type === "audio" && msg.audio?.id) {
          content = ""; // resolvido depois de transcrever, dentro de processarMensagem
          midia = { id: msg.audio.id, mimeType: msg.audio.mime_type ?? "audio/ogg", tipo: "audio" };
        }

        if (content === null) continue;

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
            content,
            botaoId,
            midia,
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

// Evento de conexão/desconexão da Coexistência. O mais importante pra
// tratar agora é PARTNER_REMOVED: o dono desconectou pelo próprio app do
// WhatsApp Business (não tem como usar o Deregister API nesse caso), então
// a gente precisa saber marcar a conta como desconectada aqui também.
async function processarAccountUpdate(params: {
  supabaseUrl: string;
  anonKey: string;
  internalSecret: string;
  value: { event?: string; phone_number?: string };
}) {
  const { supabaseUrl, anonKey, internalSecret, value } = params;
  if (value.event !== "PARTNER_REMOVED" || !value.phone_number) return;

  const supabase = createClient(supabaseUrl, anonKey);
  const { error } = await supabase.rpc("whatsapp_marcar_status", {
    p_secret: internalSecret,
    p_phone_number_id: value.phone_number,
    p_status: "desconectado",
  });
  if (error) {
    console.error("[whatsapp webhook] falha ao marcar conta desconectada (account_update)", error);
  }
}

// Guarda os webhooks de sincronização (histórico de mensagens, contatos,
// eco de mensagens do app) pra processar depois — ainda não temos a
// importação pro CRM/conversas pronta, mas nada se perde enquanto isso.
async function registrarSyncEvent(params: {
  supabaseUrl: string;
  anonKey: string;
  internalSecret: string;
  phoneNumberId: string;
  field: string;
  payload: unknown;
}) {
  const { supabaseUrl, anonKey, internalSecret, phoneNumberId, field, payload } = params;
  const supabase = createClient(supabaseUrl, anonKey);
  const { error } = await supabase.rpc("whatsapp_registrar_sync_event", {
    p_secret: internalSecret,
    p_phone_number_id: phoneNumberId,
    p_field: field,
    p_payload: payload,
  });
  if (error) {
    console.error(`[whatsapp webhook] falha ao registrar sync event (${field})`, error);
  }
}

type ResultadoInbound = {
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
  indicacao_recompensa_ativo: boolean;
  indicacao_recompensa_texto: string | null;
};

// Manda a resposta (texto, e a lista de horários clicável quando fizer
// sentido) e registra o resultado — usado tanto pela resposta normal da
// IA quanto pelo atalho de confirmação de agendamento abaixo.
async function enviarRespostaEregistrar(params: {
  supabase: SupabaseClient;
  internalSecret: string;
  creds: WhatsAppCreds;
  waId: string;
  resposta: string;
  resultado: ResultadoInbound;
  opcoesHorario?: { professional_id: string; professional_nome: string; data_hora: string }[];
}) {
  const { supabase, internalSecret, creds, waId, resposta, resultado, opcoesHorario } = params;

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

  // Lista clicável com os horários — mandada como mensagem separada, logo
  // depois do texto. Falha aqui não é grave (o cliente já recebeu a
  // resposta em texto, só não ganha os botões) — só loga.
  if (opcoesHorario && opcoesHorario.length > 0) {
    try {
      const rows = opcoesHorario.map((s) => ({
        id: `Escolho: ${formatarSlot(s)}`.slice(0, 200),
        title: formatarSlot(s),
      }));
      await sendWhatsAppInteractiveList(creds, waId, "Toca pra escolher:", "Ver horários", rows);
    } catch (err) {
      console.error("[whatsapp webhook] falha ao mandar lista de horários", err);
    }
  }
}

function formatarSlot(slot: { professional_id: string; professional_nome: string; data_hora: string }): string {
  const primeiroNome = slot.professional_nome.trim().split(/\s+/)[0] ?? slot.professional_nome;
  const dataFmt = new Date(slot.data_hora).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${primeiroNome} ${dataFmt}`.slice(0, 24);
}

type AdminIdentificado = {
  eh_admin: true;
  tenant_id: string;
  tenant_nome: string;
  access_token: string;
  admin_pin_hash: string;
  autenticado_em: string | null;
  tentativas_falhas: number;
  bloqueado_ate: string | null;
  bot_pausado: boolean;
  upsell_template_nome: string | null;
};

// Canal de gestão: o dono manda comando pro robô de um número cadastrado
// como admin em Conta > Configurações do robô. Nunca vira contato/
// conversa de CRM — é um fluxo totalmente à parte, com PIN pra confirmar
// identidade (senha não serve: ficaria gravada pra sempre naquele chat).
async function processarMensagemAdmin(params: {
  supabase: SupabaseClient;
  internalSecret: string;
  admin: AdminIdentificado;
  phoneNumberId: string;
  waId: string;
  content: string;
}) {
  const { supabase, internalSecret, admin, phoneNumberId, waId, content } = params;
  const creds: WhatsAppCreds = { phoneNumberId, token: admin.access_token };

  const enviar = async (texto: string) => {
    try {
      await sendWhatsAppText(creds, waId, texto);
      await supabase.rpc("record_whatsapp_send_success", { p_secret: internalSecret, p_tenant_id: admin.tenant_id });
    } catch (err) {
      console.error("[whatsapp webhook][admin] falha ao enviar", err);
      await supabase.rpc("record_whatsapp_send_failure", {
        p_secret: internalSecret,
        p_tenant_id: admin.tenant_id,
        p_erro: err instanceof Error ? err.message : "Falha ao enviar mensagem no canal do dono",
      });
    }
  };

  if (admin.bloqueado_ate && new Date(admin.bloqueado_ate) > new Date()) {
    const horario = new Date(admin.bloqueado_ate).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
    await enviar(`Canal bloqueado por tentativas erradas de PIN. Tenta de novo às ${horario}.`);
    return;
  }

  const autenticado =
    admin.autenticado_em !== null && Date.now() - new Date(admin.autenticado_em).getTime() < 15 * 60 * 1000;

  if (!autenticado) {
    const pinDigitado = content.trim();
    if (!/^\d{4,6}$/.test(pinDigitado)) {
      await enviar("Oi! Pra usar os comandos de gestão, manda seu PIN.");
      return;
    }
    if (!verifyPin(pinDigitado, admin.admin_pin_hash)) {
      const { data: falhaData } = await supabase.rpc("admin_registrar_falha_pin", {
        p_secret: internalSecret,
        p_tenant_id: admin.tenant_id,
      });
      const bloqueado = Boolean((falhaData as { bloqueado?: boolean } | null)?.bloqueado);
      await enviar(
        bloqueado
          ? "PIN incorreto 3x seguidas — canal bloqueado por 1h por segurança."
          : "PIN incorreto, tenta de novo.",
      );
      return;
    }
    await supabase.rpc("admin_marcar_autenticado", { p_secret: internalSecret, p_tenant_id: admin.tenant_id });
    await enviar(
      "Autenticado! O que você quer fazer? Posso: criar promoção, chamar um cliente, disparar oferta em massa, mostrar o resumo do dia, ou pausar/retomar o robô.",
    );
    return;
  }

  await supabase.rpc("admin_registrar_mensagem", {
    p_secret: internalSecret,
    p_tenant_id: admin.tenant_id,
    p_remetente: "admin",
    p_conteudo: content,
  });
  await supabase.rpc("admin_renovar_sessao", { p_secret: internalSecret, p_tenant_id: admin.tenant_id });

  const { data: historicoData } = await supabase.rpc("admin_historico_recente", {
    p_secret: internalSecret,
    p_tenant_id: admin.tenant_id,
  });
  const historico = (historicoData ?? []) as { remetente: "admin" | "bot"; conteudo: string }[];

  let resposta: string;
  try {
    const resultado = await gerarRespostaAdmin(
      { tenantId: admin.tenant_id, tenantNome: admin.tenant_nome, upsellTemplateNome: admin.upsell_template_nome },
      internalSecret,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      creds,
      historico,
    );
    resposta = resultado.resposta;
  } catch (err) {
    console.error("[whatsapp webhook][admin] falha na IA admin", err);
    resposta = "Deu ruim aqui pra processar seu comando — tenta de novo em instantinho.";
  }

  await supabase.rpc("admin_registrar_mensagem", {
    p_secret: internalSecret,
    p_tenant_id: admin.tenant_id,
    p_remetente: "bot",
    p_conteudo: resposta,
  });
  await enviar(resposta);
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
  botaoId: string | null;
  midia: { id: string; mimeType: string; tipo: "image" | "audio" } | null;
}) {
  const { supabaseUrl, anonKey, internalSecret, phoneNumberId, waId, waMessageId, contactName, botaoId, midia } =
    params;
  let content = params.content;
  const supabase = createClient(supabaseUrl, anonKey);

  // Áudio/imagem precisam do token do tenant ANTES de decidir o texto a
  // logar (transcrição vira o próprio "content"; imagem some armazenada
  // como base64 à parte, só passada direto pra IA, nunca gravada na
  // tabela messages — ficaria enorme).
  let imagemAnexada: { base64: string; mediaType: string } | undefined;
  if (midia) {
    const { data: token } = await supabase.rpc("whatsapp_token_para_numero", {
      p_secret: internalSecret,
      p_phone_number_id: phoneNumberId,
    });
    if (typeof token === "string" && token) {
      try {
        const arquivo = await baixarMidiaWhatsApp(midia.id, token);
        if (midia.tipo === "image") {
          imagemAnexada = { base64: arquivo.base64, mediaType: arquivo.mimeType };
        } else {
          const transcricao = await transcreverAudio(arquivo.base64, arquivo.mimeType);
          content = transcricao ?? "";
        }
      } catch (err) {
        console.error("[whatsapp webhook] falha ao baixar/processar mídia", err);
      }
    }
    // Sem transcrição (sem provedor configurado, ou falhou o download) —
    // segue um texto sintético pela IA em vez de mandar mensagem vazia;
    // o system prompt sabe reconhecer isso e pedir pro cliente escrever.
    if (midia.tipo === "audio" && !content) {
      content = "[Cliente mandou um áudio, mas não consegui converter pra texto ainda]";
    }
  }

  // Verifica ANTES de tudo se quem mandou é o número admin cadastrado —
  // nesse caso nunca cria contato/conversa de CRM, vai direto pro canal
  // de comandos.
  const { data: adminData } = await supabase.rpc("admin_identificar", {
    p_secret: internalSecret,
    p_phone_number_id: phoneNumberId,
    p_wa_id: waId,
  });
  if ((adminData as { eh_admin?: boolean } | null)?.eh_admin) {
    await processarMensagemAdmin({
      supabase,
      internalSecret,
      admin: adminData as AdminIdentificado,
      phoneNumberId,
      waId,
      content,
    });
    return;
  }

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

  const resultado = data as ResultadoInbound;

  if (resultado?.erro) {
    // "tenant_nao_encontrado": número não está conectado a nenhum negócio —
    // "ja_processada": reentrega da Meta pro mesmo evento (idempotência).
    return;
  }

  // Conversa já está com um humano — a IA não responde, o dono/equipe
  // responde manualmente pelo /conversas.
  if (resultado.conversation_status !== "bot") return;

  const creds = { phoneNumberId: resultado.whatsapp_phone_number_id, token: resultado.whatsapp_access_token };

  // Atalho determinístico pro botão "Confirmar" do lembrete (cron de
  // lembretes) — não precisa passar pela IA, é só marcar e responder.
  if (botaoId?.startsWith("confirmar:")) {
    const appointmentId = botaoId.slice("confirmar:".length);
    const { data: confirmData } = await supabase.rpc("confirmar_agendamento", {
      p_secret: internalSecret,
      p_appointment_id: appointmentId,
      p_telefone: waId,
    });
    const ok = Boolean((confirmData as { ok?: boolean } | null)?.ok);
    const resposta = ok
      ? "Prontinho, confirmado! Te esperamos ✅"
      : "Não achei esse agendamento aqui — me chama que eu vejo com a equipe.";
    await enviarRespostaEregistrar({ supabase, internalSecret, creds, waId, resposta, resultado });
    return;
  }
  // "Preciso remarcar" cai direto no fluxo normal da IA (ela já sabe
  // remarcar), então não precisa de atalho — só segue pro código abaixo.

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
    indicacaoRecompensaAtiva: resultado.indicacao_recompensa_ativo,
    indicacaoRecompensaTexto: resultado.indicacao_recompensa_texto,
  };

  let resposta: string;
  let opcoesHorario: ResultadoIA["opcoesHorario"];
  try {
    const resultadoIA = await gerarRespostaWhatsApp(ctx, internalSecret, supabaseUrl, anonKey, imagemAnexada);
    resposta = resultadoIA.resposta;
    opcoesHorario = resultadoIA.opcoesHorario;

    // Ofereceu horário e o cliente ainda não confirmou — guarda pra
    // recuperação de conversa esfriada tentar retomar depois (ver cron
    // de pós-venda). Aguarda (função serverless pode ser encerrada assim
    // que a resposta volta), mas falha aqui não pode travar o envio.
    if (resultadoIA.propostaPendente) {
      const { error } = await supabase.rpc("ia_marcar_proposta_pendente", {
        p_secret: internalSecret,
        p_conversation_id: resultado.conversation_id,
        p_tenant_id: resultado.tenant_id,
        p_pendente: true,
        p_resumo: resposta.slice(0, 300),
      });
      if (error) console.error("[whatsapp webhook] falha ao marcar proposta pendente", error);
    }
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

  // Antes, uma falha de envio aqui sumia sem ninguém saber — cliente sem
  // resposta, dono sem aviso. Isso é tratado dentro de enviarRespostaEregistrar.
  await enviarRespostaEregistrar({ supabase, internalSecret, creds, waId, resposta, resultado, opcoesHorario });
}

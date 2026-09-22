// Histórico de até 180 dias que a Meta manda na Coexistência (webhook
// "history") e a lista de contatos do WhatsApp Business do cliente
// (webhook "smb_app_state_sync") — parseia os dois formatos oficiais e
// gera o resumo por contato que a IA usa de contexto.

import type { SupabaseClient } from "@supabase/supabase-js";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export type MensagemHistorico = {
  telefone: string;
  remetente: "contato" | "negocio";
  tipo: string;
  conteudo: string | null;
  waMessageId: string | null;
  enviadoEm: number; // unix timestamp (segundos)
};

type HistoryThreadMessage = {
  from?: string;
  to?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  [key: string]: unknown;
};

type HistoryPayload = {
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  history?: {
    metadata?: { phase?: number; chunk_order?: number; progress?: number };
    threads?: { id?: string; messages?: HistoryThreadMessage[] }[];
  }[];
};

// Mensagens de tipo != text não têm corpo de texto direto — guarda uma
// descrição curta em vez do conteúdo bruto (evita salvar payload de
// mídia inteiro numa coluna de texto).
function descreverConteudo(msg: HistoryThreadMessage): string | null {
  if (msg.type === "text") return msg.text?.body ?? null;
  if (msg.type === "media_placeholder") return "[mídia — aguardando detalhes]";
  if (msg.type) return `[${msg.type}]`;
  return null;
}

export function parseHistoricoPayload(value: HistoryPayload, businessPhoneNumber: string | undefined): MensagemHistorico[] {
  const mensagens: MensagemHistorico[] = [];

  for (const phase of value.history ?? []) {
    for (const thread of phase.threads ?? []) {
      const telefoneContato = thread.id;
      if (!telefoneContato) continue;

      for (const msg of thread.messages ?? []) {
        const timestamp = msg.timestamp ? Number(msg.timestamp) : null;
        if (!timestamp || !msg.id) continue;

        const remetente: "contato" | "negocio" =
          msg.from && businessPhoneNumber && msg.from === businessPhoneNumber ? "negocio" : "contato";

        mensagens.push({
          telefone: telefoneContato,
          remetente,
          tipo: msg.type ?? "text",
          conteudo: descreverConteudo(msg),
          waMessageId: msg.id,
          enviadoEm: timestamp,
        });
      }
    }
  }

  return mensagens;
}

export type ContatoSync = { telefone: string; nome: string | null; action: "add" | "remove" | string };

type StateSyncPayload = {
  state_sync?: {
    action?: string;
    contact?: { phone_number?: string; full_name?: string; first_name?: string };
  }[];
};

export function parseContatoSyncPayload(value: StateSyncPayload): ContatoSync[] {
  const contatos: ContatoSync[] = [];
  for (const item of value.state_sync ?? []) {
    const telefone = item.contact?.phone_number;
    if (!telefone) continue;
    contatos.push({
      telefone,
      nome: item.contact?.full_name ?? item.contact?.first_name ?? null,
      action: item.action ?? "add",
    });
  }
  return contatos;
}

export type ResumoHistorico = {
  resumo: string;
  classificacao: "cliente" | "apenas_conversou" | "indefinido";
};

// Resume a conversa antiga em 1-2 frases + sugere uma classificação — a
// IA de atendimento só usa o resumo como contexto ("já conhece essa
// pessoa"), e a classificação é só uma SUGESTÃO pro dono confirmar depois,
// nunca aplica direto no funil.
export async function resumirHistoricoContato(
  mensagens: { remetente: "contato" | "negocio"; conteudo: string | null }[],
): Promise<ResumoHistorico | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || mensagens.length === 0) return null;

  const transcricao = mensagens
    .slice(-60)
    .map((m) => `${m.remetente === "contato" ? "Cliente" : "Negócio"}: ${m.conteudo ?? "[sem texto]"}`)
    .join("\n");

  const prompt = [
    "Você está lendo uma conversa antiga de WhatsApp entre um negócio e um contato, pra ajudar quem atende a lembrar rápido quem é essa pessoa.",
    "Responda em JSON, só com esse formato, nada além disso:",
    '{"resumo": "1-2 frases curtas e objetivas sobre quem é esse contato e do que já falaram", "classificacao": "cliente" | "apenas_conversou" | "indefinido"}',
    '"cliente" = deu pra perceber que ela chegou a comprar/agendar algo. "apenas_conversou" = só perguntou, comparou preço, ou nunca fechou nada. "indefinido" = não deu pra saber pelo texto.',
    "Conversa:",
    transcricao,
  ].join("\n\n");

  const resp = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    console.error("[whatsapp-historico] falha ao chamar a IA pro resumo", await resp.text());
    return null;
  }

  const data = await resp.json();
  const textoResposta = data?.content?.[0]?.text ?? "";

  try {
    const match = textoResposta.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const classificacao = ["cliente", "apenas_conversou", "indefinido"].includes(parsed.classificacao)
      ? parsed.classificacao
      : "indefinido";
    if (typeof parsed.resumo !== "string" || !parsed.resumo.trim()) return null;
    return { resumo: parsed.resumo.trim(), classificacao };
  } catch (err) {
    console.error("[whatsapp-historico] resposta da IA não é JSON válido", err, textoResposta);
    return null;
  }
}

// Roda em lote pelo cron: pega quem ainda não tem resumo, gera via IA e
// salva. Um lote pequeno por vez — não trava o cron se tiver muita coisa
// acumulada, o resto fica pro próximo dia.
export async function processarResumosHistoricoPendentes(
  supabase: SupabaseClient,
  secret: string,
): Promise<{ resumidos: number; falhas: number }> {
  const { data: pendentesData, error: pendentesError } = await supabase.rpc(
    "whatsapp_listar_historico_pendente_resumo",
    { p_secret: secret, p_limite: 15 },
  );
  if (pendentesError) {
    console.error("[whatsapp-historico] falha ao listar pendentes de resumo", pendentesError);
    return { resumidos: 0, falhas: 0 };
  }

  const pendentes = (pendentesData ?? []) as { id: string; tenant_id: string; telefone: string }[];
  let resumidos = 0;
  let falhas = 0;

  for (const item of pendentes) {
    try {
      const { data: mensagensData } = await supabase.rpc("whatsapp_listar_mensagens_historico", {
        p_secret: secret,
        p_tenant_id: item.tenant_id,
        p_telefone: item.telefone,
      });
      const mensagens = (mensagensData ?? []) as { remetente: "contato" | "negocio"; conteudo: string | null }[];

      const resultado = await resumirHistoricoContato(mensagens);
      if (!resultado) {
        falhas++;
        continue;
      }

      const { error } = await supabase.rpc("whatsapp_registrar_resumo_historico", {
        p_secret: secret,
        p_id: item.id,
        p_resumo: resultado.resumo,
        p_classificacao: resultado.classificacao,
      });
      if (error) {
        falhas++;
      } else {
        resumidos++;
      }
    } catch (err) {
      console.error("[whatsapp-historico] falha ao resumir contato", item.telefone, err);
      falhas++;
    }
  }

  return { resumidos, falhas };
}

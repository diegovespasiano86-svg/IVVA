// Resume conversas encerradas/esfriadas usando o Claude — mesmo espírito
// de extracao-conhecimento.ts: fetch direto na Messages API, sem SDK.
// Alimenta o dashboard de atendimento (/conversas?view=dashboard) e o
// resumo individual em /conversas/[id].

import type { SupabaseClient } from "@supabase/supabase-js";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

function headers() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("IA não configurada (falta ANTHROPIC_API_KEY)");
  return {
    "x-api-key": key,
    "anthropic-version": ANTHROPIC_VERSION,
    "content-type": "application/json",
  };
}

export const CATEGORIAS = [
  "agendamento",
  "duvida_preco",
  "reclamacao",
  "cancelamento",
  "outro",
] as const;
export type CategoriaResumo = (typeof CATEGORIAS)[number];
export type DesfechoResumo = "fechou" | "nao_fechou";
export type Sentimento = "positivo" | "neutro" | "negativo";
export const SENTIMENTO_LABEL: Record<Sentimento, string> = { positivo: "Positivo", neutro: "Neutro", negativo: "Negativo" };

export const CATEGORIA_LABEL: Record<CategoriaResumo, string> = {
  agendamento: "Agendamento",
  duvida_preco: "Dúvida de preço/serviço",
  reclamacao: "Reclamação",
  cancelamento: "Cancelamento",
  outro: "Outro",
};

const SYSTEM_PROMPT = `Você vai ler a transcrição de uma conversa entre um cliente e o assistente de WhatsApp (ivva) de um negócio local (salão, estética, pet shop, loja ou alimentação sob encomenda). Gere um resumo estruturado pro dono do negócio revisar rapidamente, sem precisar reler a conversa inteira.

Devolva SOMENTE um objeto JSON, sem nenhum texto antes ou depois, no formato:
{"resumo": "...", "categoria": "...", "desfecho": "...", "perguntas_principais": ["...", "..."], "sentimento": "...", "interesse": 3, "motivo_perda": "..."}

Regras:
- "resumo": 2-3 frases objetivas, em português, contando o que o cliente queria e como terminou.
- "categoria": o motivo PRINCIPAL do contato — um destes valores exatos: "agendamento", "duvida_preco", "reclamacao", "cancelamento", "outro". Se o cliente só perguntou preço/horário e nunca confirmou nada, é "duvida_preco", não "agendamento".
- "desfecho": "fechou" se o cliente confirmou um agendamento, resolveu o problema, ou a conversa terminou de forma satisfatória. "nao_fechou" se o cliente demonstrou interesse mas não confirmou nada, sumiu no meio, ou desistiu.
- "perguntas_principais": até 3 perguntas ou pedidos do cliente, cada um como frase curta (ex: "Quanto custa corte + barba", "Tem horário sábado de manhã").
- "sentimento": como o cliente se mostrou no geral: "positivo", "neutro" ou "negativo".
- "interesse": número inteiro de 1 a 5 do quanto o cliente quer comprar/agendar. 1 = só curiosidade, 3 = comparando, 5 = pronto para fechar ou já fechou.
- "motivo_perda": se o desfecho for "nao_fechou", a PROVÁVEL razão em até 8 palavras (ex: "achou o preço alto", "sem horário no dia", "sumiu depois de ver o valor"). Se fechou, use "".
- Nunca invente informação que não está na transcrição.`;

type ResumoConversa = {
  resumo: string;
  categoria: CategoriaResumo;
  desfecho: DesfechoResumo;
  perguntas_principais: string[];
  sentimento: Sentimento;
  interesse: number;
  motivo_perda: string;
};

export async function resumirConversa(transcript: string): Promise<ResumoConversa> {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 640,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: transcript }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao resumir a conversa");
  }

  type ContentBlock = { type: string; text?: string };
  const textoResposta = ((data.content ?? []) as ContentBlock[])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  const match = textoResposta.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : textoResposta);

  const categoria: CategoriaResumo = CATEGORIAS.includes(parsed.categoria)
    ? parsed.categoria
    : "outro";
  const desfecho: DesfechoResumo = parsed.desfecho === "fechou" ? "fechou" : "nao_fechou";
  const perguntas = Array.isArray(parsed.perguntas_principais)
    ? parsed.perguntas_principais
        .filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
        .slice(0, 3)
    : [];

  const sentimento: Sentimento = ["positivo", "neutro", "negativo"].includes(parsed.sentimento) ? parsed.sentimento : "neutro";
  const interesse = Math.min(5, Math.max(1, Math.round(Number(parsed.interesse)) || 3));
  const motivo_perda = desfecho === "nao_fechou" && typeof parsed.motivo_perda === "string" ? parsed.motivo_perda.trim().slice(0, 80) : "";

  return {
    resumo: typeof parsed.resumo === "string" && parsed.resumo.trim() ? parsed.resumo.trim() : "Sem resumo disponível.",
    categoria,
    desfecho,
    perguntas_principais: perguntas,
    sentimento,
    interesse,
    motivo_perda,
  };
}

type ConversaPendente = {
  conversation_id: string;
  tenant_id: string;
  contact_id: string;
  transcript: string | null;
};

// Chamado 1x/dia pelo cron de pós-venda (Hobby só libera 2 crons — ver
// vercel.json). Processa no máximo o lote que a RPC devolve por vez.
export async function processarResumosPendentes(
  supabase: SupabaseClient,
  secret: string,
): Promise<{ resumidas: number; falhas: number }> {
  const { data, error } = await supabase.rpc("list_conversas_para_resumir", {
    p_secret: secret,
  });
  if (error) {
    console.error("[resumo-conversas] erro ao listar pendentes", error);
    return { resumidas: 0, falhas: 0 };
  }

  const pendentes = (data ?? []) as ConversaPendente[];
  let resumidas = 0;
  let falhas = 0;

  for (const item of pendentes) {
    if (!item.transcript?.trim()) continue;
    try {
      const resultado = await resumirConversa(item.transcript);
      const { error: recordError } = await supabase.rpc("record_conversation_summary", {
        p_secret: secret,
        p_conversation_id: item.conversation_id,
        p_resumo: resultado.resumo,
        p_categoria: resultado.categoria,
        p_desfecho: resultado.desfecho,
        p_perguntas_principais: resultado.perguntas_principais,
        p_sentimento: resultado.sentimento,
        p_interesse: resultado.interesse,
        p_motivo_perda: resultado.motivo_perda || null,
      });
      if (recordError) throw recordError;
      resumidas++;
    } catch (err) {
      falhas++;
      console.error("[resumo-conversas] falha ao resumir conversa", item.conversation_id, err);
    }
  }

  return { resumidas, falhas };
}

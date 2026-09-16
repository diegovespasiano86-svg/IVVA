// Extrai entradas de base de conhecimento a partir de texto solto, PDF
// ou transcrição de áudio — mesmo espírito de lib/ai.ts: fetch direto na
// Messages API, sem SDK.

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

const SYSTEM_PROMPT = `Você vai ler o conteúdo enviado (pode ser uma planilha de preços, um catálogo em PDF, ou a transcrição de um áudio do dono contando sobre o negócio) e extrair fatos objetivos e atômicos pra virar contexto de um assistente de WhatsApp que atende os clientes desse negócio.

Cada entrada deve:
- ser uma frase curta e autocontida (ex: "Corte + barba custa R$80 e leva 40 minutos.")
- não repetir outras entradas nem o que já é óbvio
- trazer só fatos verificáveis: preço, duração, política de cancelamento, horário, endereço, forma de pagamento, produtos, promoções etc. — nunca opinião ou enrolação

Devolva SOMENTE um array JSON de strings, sem nenhum texto antes ou depois, tipo ["fato 1", "fato 2"]. Se não houver fatos úteis no conteúdo, devolva [].`;

type ClaudeContentBlock =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: { type: "base64"; media_type: string; data: string };
    };

export async function extrairEntradasConhecimento(params: {
  texto?: string;
  documentoBase64?: string;
  documentoMediaType?: string;
}): Promise<string[]> {
  const content: ClaudeContentBlock[] = [];
  if (params.documentoBase64 && params.documentoMediaType) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: params.documentoMediaType,
        data: params.documentoBase64,
      },
    });
  }
  if (params.texto?.trim()) {
    content.push({ type: "text", text: params.texto.trim() });
  }
  if (content.length === 0) return [];

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error?.message ?? "Falha ao processar o conteúdo enviado",
    );
  }

  type ContentBlock = { type: string; text?: string };
  const textoResposta = ((data.content ?? []) as ContentBlock[])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  try {
    const match = textoResposta.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : textoResposta);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
  } catch {
    return [];
  }
}

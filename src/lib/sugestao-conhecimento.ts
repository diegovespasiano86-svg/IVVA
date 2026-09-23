// Quando um ticket de SAC é resolvido, tenta aprender com o que o humano
// respondeu — mesmo espírito de resumo-conversas.ts: fetch direto na
// Messages API. Nunca grava direto na base de conhecimento; só sugere
// (ver knowledge_base_sugestoes), pro dono revisar em Base de conhecimento.

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

const SYSTEM_PROMPT = `Você vai ler a transcrição de um trecho de conversa em que o robô de atendimento (ivva) de um negócio local não soube responder e pediu ajuda de um humano, que assumiu e resolveu ali mesmo. Sua tarefa é decidir se dá pra extrair dali um FATO REUTILIZÁVEL pra base de conhecimento do robô, pra ele responder sozinho da próxima vez que alguém perguntar algo parecido.

Devolva SOMENTE um objeto JSON, sem nenhum texto antes ou depois, no formato:
{"tem_fato": true, "fato": "...", "pergunta_cliente": "..."}

Regras:
- "tem_fato": true só quando a resposta do humano ensina algo GENÉRICO e REPETÍVEL (preço, prazo, política, procedimento, horário, forma de pagamento etc). false quando foi algo específico daquele cliente ou pedido (reembolso pontual, reclamação pessoal, "deixa eu verificar e te aviso", dado de agendamento específico), ou quando o humano não chegou a responder nada de fato.
- "fato": uma frase objetiva em português, no mesmo estilo de um item de base de conhecimento (ex: "Cancelamento com menos de 2h de antecedência tem taxa de 50%."). Nunca invente informação que não veio da resposta do humano na transcrição.
- "pergunta_cliente": resuma em poucas palavras o que o cliente queria saber, só pra dar contexto rápido na hora de revisar.
- Se "tem_fato" for false, devolva "fato" e "pergunta_cliente" como strings vazias.`;

export type SugestaoConhecimento = {
  temFato: boolean;
  fato: string;
  perguntaCliente: string;
};

export async function sugerirFatoConhecimento(
  transcript: string,
): Promise<SugestaoConhecimento | null> {
  if (!transcript.trim()) return null;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: transcript }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[sugestao-conhecimento] falha na API", data?.error);
      return null;
    }

    type ContentBlock = { type: string; text?: string };
    const textoResposta = ((data.content ?? []) as ContentBlock[])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    const match = textoResposta.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : textoResposta);

    return {
      temFato: parsed.tem_fato === true,
      fato: typeof parsed.fato === "string" ? parsed.fato.trim() : "",
      perguntaCliente:
        typeof parsed.pergunta_cliente === "string" ? parsed.pergunta_cliente.trim() : "",
    };
  } catch (err) {
    console.error("[sugestao-conhecimento] falha ao gerar sugestão", err);
    return null;
  }
}

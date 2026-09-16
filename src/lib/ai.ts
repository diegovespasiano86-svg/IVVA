// Cliente da IA generativa (Claude) que responde pelo WhatsApp. Sem SDK —
// fetch direto na Messages API, no mesmo espírito do lib/stripe.ts.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const MAX_TOOL_TURNS = 4;

type IdentidadeAssistente = {
  nome_assistente?: string;
  tom?: string;
  regras?: string[];
  horario_atendimento?: string;
};

type HistoricoItem = { remetente: "contato" | "bot" | "humano"; conteudo: string };

export type ContextoConversa = {
  tenantId: string;
  tenantNome: string;
  identidadeAssistente: IdentidadeAssistente | null;
  conversationId: string;
  contactId: string;
  contactNome: string;
  contactIsNovo: boolean;
  historico: HistoricoItem[];
};

export type ResultadoIA = {
  resposta: string;
  handoffSolicitado: boolean;
};

function headers() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("IA não configurada (falta ANTHROPIC_API_KEY)");
  return {
    "x-api-key": key,
    "anthropic-version": ANTHROPIC_VERSION,
    "content-type": "application/json",
  };
}

function montarSystemPrompt(ctx: ContextoConversa) {
  const id = ctx.identidadeAssistente ?? {};
  const nomeAssistente = id.nome_assistente?.trim() || "a recepção";
  const tom = id.tom?.trim() || "cordial, direto e natural — nada robótico";
  const regras = (id.regras ?? []).map((r) => `- ${r}`).join("\n");
  const horario = id.horario_atendimento?.trim();

  const linhasQualificacao = ctx.contactIsNovo
    ? `Esse é o primeiro contato de ${ctx.contactNome || "essa pessoa"} com ${ctx.tenantNome}. ` +
      `Em algum momento natural da conversa — sem parecer formulário, sem despejar tudo de uma vez — ` +
      `descubra: o nome da pessoa (se ainda não souber), se ela já é cliente antes ou é a primeira vez, ` +
      `e como ela chegou até vocês (indicação, Instagram, passou na rua, etc.). ` +
      `Assim que souber algo disso, chame a ferramenta atualizar_contato pra registrar — não é pra perguntar tudo de uma vez.`
    : `Essa pessoa já teve contato antes. Use o histórico abaixo pra continuar a conversa com naturalidade, sem se reapresentar como se fosse a primeira vez.`;

  return [
    `Você é ${nomeAssistente}, quem atende o WhatsApp de ${ctx.tenantNome} — um negócio de serviços.`,
    `Tom de voz: ${tom}.`,
    `Nunca use uma saudação decorada ou genérica — responda como uma pessoa real do time responderia, adaptando ao que foi dito.`,
    linhasQualificacao,
    horario ? `Horário de atendimento humano: ${horario}.` : "",
    regras ? `Regras específicas desse negócio:\n${regras}` : "",
    `Se o cliente pedir claramente pra falar com uma pessoa, reclamar de algo sério, ou se você não souber responder com segurança, chame a ferramenta solicitar_atendimento_humano explicando o motivo — não invente informação que você não tem.`,
    `Responda sempre em português do Brasil, em mensagens curtas como quem digita no WhatsApp de verdade — não em blocos longos de texto.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const TOOLS = [
  {
    name: "atualizar_contato",
    description:
      "Registra dados que você aprendeu sobre o contato durante a conversa (nome, e-mail, se já é cliente ou é o primeiro contato, como conheceu o negócio). Chame assim que souber, sem esperar o fim da conversa.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome da pessoa, se ficou sabendo" },
        email: { type: "string", description: "E-mail, se a pessoa passou" },
        tipo_relacionamento: {
          type: "string",
          enum: ["primeiro_contato", "sem_contato", "cliente"],
          description:
            "cliente = já é cliente do negócio; primeiro_contato = primeira vez que fala com eles; sem_contato = interessado mas nunca teve contato antes",
        },
        como_conheceu: { type: "string", description: "Como a pessoa chegou até o negócio" },
      },
    },
  },
  {
    name: "solicitar_atendimento_humano",
    description:
      "Passa a conversa pra um atendente humano. Use quando o cliente pedir explicitamente, quando houver reclamação séria, ou quando você não tiver certeza da resposta.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Por que está pedindo handoff" },
      },
      required: ["motivo"],
    },
  },
] as const;

type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
};

async function chamarClaude(system: string, messages: ClaudeMessage[]) {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
      tools: TOOLS,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao chamar a IA");
  }
  return data as { content: ClaudeContentBlock[]; stop_reason: string };
}

async function executarFerramenta(
  nome: string,
  input: Record<string, unknown>,
  ctx: ContextoConversa,
  secret: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ resultado: string; handoff: boolean }> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, anonKey);

  if (nome === "atualizar_contato") {
    await supabase.rpc("ia_atualizar_contato", {
      p_secret: secret,
      p_contact_id: ctx.contactId,
      p_tenant_id: ctx.tenantId,
      p_nome: input.nome ?? null,
      p_email: input.email ?? null,
      p_tipo_relacionamento: input.tipo_relacionamento ?? null,
      p_como_conheceu: input.como_conheceu ?? null,
    });
    return { resultado: "ok", handoff: false };
  }

  if (nome === "solicitar_atendimento_humano") {
    await supabase.rpc("ia_solicitar_handoff", {
      p_secret: secret,
      p_conversation_id: ctx.conversationId,
      p_tenant_id: ctx.tenantId,
      p_motivo: input.motivo ?? "não especificado",
    });
    return { resultado: "ok", handoff: true };
  }

  return { resultado: "ferramenta desconhecida", handoff: false };
}

// Gera a resposta da IA pro WhatsApp. Executa as ferramentas que o modelo
// chamar (registrar dado de contato, pedir handoff) em loop até ele dar uma
// resposta de texto final, ou até MAX_TOOL_TURNS pra nunca ficar preso.
export async function gerarRespostaWhatsApp(
  ctx: ContextoConversa,
  secret: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<ResultadoIA> {
  const system = montarSystemPrompt(ctx);

  const messages: ClaudeMessage[] = ctx.historico.map((m) => ({
    role: m.remetente === "contato" ? "user" : "assistant",
    content: m.conteudo,
  }));

  let handoffSolicitado = false;

  for (let turno = 0; turno < MAX_TOOL_TURNS; turno++) {
    const resposta = await chamarClaude(system, messages);

    const blocosTexto = resposta.content.filter((b) => b.type === "text") as { type: "text"; text: string }[];
    const blocosFerramenta = resposta.content.filter((b) => b.type === "tool_use") as {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }[];

    if (blocosFerramenta.length === 0) {
      const texto = blocosTexto.map((b) => b.text).join("\n\n").trim();
      return { resposta: texto || "Certo!", handoffSolicitado };
    }

    messages.push({ role: "assistant", content: resposta.content });

    // Executa cada ferramenta que o modelo chamou e devolve o resultado no
    // formato tool_result que a Messages API exige na próxima rodada.
    const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
    for (const bloco of blocosFerramenta) {
      const { resultado, handoff } = await executarFerramenta(
        bloco.name,
        bloco.input,
        ctx,
        secret,
        supabaseUrl,
        anonKey,
      );
      if (handoff) handoffSolicitado = true;
      toolResults.push({ type: "tool_result", tool_use_id: bloco.id, content: resultado });
    }

    messages.push({ role: "user", content: toolResults as unknown as ClaudeContentBlock[] });
  }

  return {
    resposta: "Só um instante que já te retorno.",
    handoffSolicitado: true, // não convergiu em MAX_TOOL_TURNS — melhor jogar pra humano do que ficar em loop
  };
}

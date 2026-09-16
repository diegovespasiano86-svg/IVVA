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

type Profissional = { id: string; nome: string };

export type ContextoConversa = {
  tenantId: string;
  tenantNome: string;
  identidadeAssistente: IdentidadeAssistente | null;
  conversationId: string;
  contactId: string;
  contactNome: string;
  contactIsNovo: boolean;
  historico: HistoricoItem[];
  profissionais: Profissional[];
  horarioAbertura: string | null;
  horarioFechamento: string | null;
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

  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const listaProfissionais = ctx.profissionais.length
    ? ctx.profissionais.map((p) => `- ${p.nome}`).join("\n")
    : null;

  const linhasAgenda = [
    `Agora é ${agora} (horário de Brasília).`,
    ctx.horarioAbertura && ctx.horarioFechamento
      ? `Funcionamento: ${ctx.horarioAbertura.slice(0, 5)} às ${ctx.horarioFechamento.slice(0, 5)}.`
      : "",
    listaProfissionais ? `Profissionais desse negócio:\n${listaProfissionais}` : "",
    `Quando o cliente quiser marcar, remarcar ou cancelar um horário, siga sempre esta ordem:`,
    `1. Chame consultar_disponibilidade pra ver horários realmente livres — nunca invente ou suponha um horário.`,
    `2. Ofereça 2-3 opções reais (data + hora + profissional, se houver mais de um) e espere o cliente escolher/confirmar.`,
    `3. Só depois da confirmação explícita do cliente, chame criar_agendamento (ou remarcar_ou_cancelar_agendamento pra mudar algo já marcado).`,
    `4. NUNCA diga algo como "vou confirmar com a equipe e te retorno" — você tem acesso direto à agenda, então ou você resolve na hora chamando as ferramentas, ou explica o que falta pro cliente decidir. Depois de criar/remarcar/cancelar um agendamento, sua resposta final SEMPRE repete o horário exato marcado (dia, hora e profissional) — nunca deixa a confirmação implícita.`,
    `Se não achar nenhum horário livre nos critérios pedidos, diga isso claramente e ofereça alternativas (outro dia, outro profissional) em vez de inventar disponibilidade.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    `Você é ${nomeAssistente}, quem atende o WhatsApp de ${ctx.tenantNome} — um negócio de serviços.`,
    `Tom de voz: ${tom}.`,
    `Nunca use uma saudação decorada ou genérica — responda como uma pessoa real do time responderia, adaptando ao que foi dito.`,
    linhasQualificacao,
    linhasAgenda,
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
      "Passa a conversa pra um atendente humano. Use quando o cliente pedir explicitamente, quando houver reclamação séria, ou quando você não tiver certeza da resposta. NÃO use isso pra agendamento — pra agendar, use consultar_disponibilidade e criar_agendamento, que resolvem na hora.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Por que está pedindo handoff" },
      },
      required: ["motivo"],
    },
  },
  {
    name: "consultar_disponibilidade",
    description:
      "Busca horários realmente livres na agenda. Sem profissional_id, devolve uma opção por profissional (pra cliente comparar); com profissional_id, devolve várias opções daquele profissional. Sempre chame isso antes de agendar — nunca suponha um horário livre.",
    input_schema: {
      type: "object",
      properties: {
        duracao_minutos: { type: "integer", description: "Duração estimada do serviço em minutos (padrão 30 se não souber)" },
        profissional_id: { type: "string", description: "ID do profissional, se o cliente já escolheu um" },
        a_partir_de: { type: "string", description: "Data/hora ISO a partir de quando buscar (ex: cliente pediu 'só depois de sábado'). Omitir pra buscar a partir de agora." },
      },
    },
  },
  {
    name: "criar_agendamento",
    description:
      "Marca um horário de verdade na agenda. Só chame depois que o cliente confirmar explicitamente um horário oferecido por consultar_disponibilidade.",
    input_schema: {
      type: "object",
      properties: {
        profissional_id: { type: "string", description: "ID do profissional escolhido" },
        servico: { type: "string", description: "O que vai ser feito, em texto (ex: 'corte e barba')" },
        data_hora: { type: "string", description: "Data/hora ISO exata confirmada pelo cliente" },
        duracao_minutos: { type: "integer", description: "Duração em minutos (padrão 30)" },
      },
      required: ["profissional_id", "servico", "data_hora"],
    },
  },
  {
    name: "remarcar_ou_cancelar_agendamento",
    description:
      "Remarca ou cancela um agendamento já existente do cliente. Se o cliente não especificar qual (e ele só tiver um marcado), pode omitir appointment_id que o sistema acha automaticamente o próximo agendamento dele.",
    input_schema: {
      type: "object",
      properties: {
        acao: { type: "string", enum: ["remarcar", "cancelar"] },
        appointment_id: { type: "string", description: "ID do agendamento, se conhecido" },
        nova_data_hora: { type: "string", description: "Nova data/hora ISO confirmada pelo cliente (obrigatório se acao=remarcar)" },
      },
      required: ["acao"],
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

  if (nome === "consultar_disponibilidade") {
    const { data, error } = await supabase.rpc("ia_consultar_disponibilidade", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
      p_duracao_minutos: input.duracao_minutos ?? 30,
      p_professional_id: input.profissional_id ?? null,
      p_a_partir_de: input.a_partir_de ?? null,
    });
    if (error) return { resultado: JSON.stringify({ erro: error.message }), handoff: false };
    return { resultado: JSON.stringify(data), handoff: false };
  }

  if (nome === "criar_agendamento") {
    const { data, error } = await supabase.rpc("ia_criar_agendamento", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
      p_contact_id: ctx.contactId,
      p_professional_id: input.profissional_id,
      p_servico: input.servico,
      p_data_hora: input.data_hora,
      p_duracao_minutos: input.duracao_minutos ?? 30,
    });
    if (error) return { resultado: JSON.stringify({ erro: error.message }), handoff: false };
    return { resultado: JSON.stringify(data), handoff: false };
  }

  if (nome === "remarcar_ou_cancelar_agendamento") {
    const { data, error } = await supabase.rpc("ia_remarcar_ou_cancelar_agendamento", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
      p_contact_id: ctx.contactId,
      p_acao: input.acao,
      p_appointment_id: input.appointment_id ?? null,
      p_nova_data_hora: input.nova_data_hora ?? null,
    });
    if (error) return { resultado: JSON.stringify({ erro: error.message }), handoff: false };
    return { resultado: JSON.stringify(data), handoff: false };
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

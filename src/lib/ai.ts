// Cliente da IA generativa (Claude) que responde pelo WhatsApp. Sem SDK —
// fetch direto na Messages API, no mesmo espírito do lib/stripe.ts.

import { createPixPaymentIntent } from "@/lib/stripe";

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
  /** horários oferecidos na última consulta de disponibilidade desse turno
   * (pra mandar como lista clicável no WhatsApp, além do texto) */
  opcoesHorario?: Slot[];
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
    `Se a mensagem do cliente for literalmente "[Cliente mandou um áudio, mas não consegui converter pra texto ainda]", isso significa que a transcrição de voz não está disponível agora — peça educadamente pra ele escrever a mensagem, sem fingir que ouviu algo.`,
    `Se vier uma imagem anexada, ela é real (uma foto que o cliente mandou) — descreva o que vê com naturalidade e responda ao que ele quis dizer com a foto (referência de corte, foto de um problema, etc.), sem inventar detalhes que não dá pra ver.`,
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
  {
    name: "consultar_avisos_ativos",
    description:
      "Verifica se há promoção, feriado ou ausência de profissional cadastrados pro dono que estejam valendo hoje. Chame isso quando o assunto for agendamento, preço ou disponibilidade — se algo valendo afetar o que o cliente quer, avise proativamente antes de seguir.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "consultar_catalogo",
    description: "Busca produtos e informações da base de conhecimento do negócio por palavra-chave (preços, serviços, políticas). Use quando o cliente perguntar sobre algo que você não tem certeza.",
    input_schema: {
      type: "object",
      properties: { busca: { type: "string", description: "Palavra-chave a buscar" } },
      required: ["busca"],
    },
  },
  {
    name: "solicitar_pagamento_pix",
    description: "Gera uma cobrança Pix (código copia-e-cola) pra sinal de um serviço de ticket alto. Só use depois que o cliente já confirmou o serviço/valor e concordou em pagar o sinal.",
    input_schema: {
      type: "object",
      properties: {
        valor_reais: { type: "number", description: "Valor do sinal em reais (ex: 50 pra R$50,00)" },
        descricao: { type: "string", description: "O que é a cobrança (ex: 'Sinal - coloração')" },
      },
      required: ["valor_reais", "descricao"],
    },
  },
] as const;

type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

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

type Slot = { professional_id: string; professional_nome: string; data_hora: string };

async function executarFerramenta(
  nome: string,
  input: Record<string, unknown>,
  ctx: ContextoConversa,
  secret: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ resultado: string; handoff: boolean; slots?: Slot[]; reservaFeita?: boolean }> {
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
    const slots = (data as { slots?: Slot[] } | null)?.slots ?? [];
    // Essas opções também vão sair como lista clicável no WhatsApp (ver
    // route.ts) — avisa o modelo pra não precisar enumerar cada uma em
    // texto corrido, só confirmar que vai mandar as opções.
    const resultadoComDica =
      slots.length > 0
        ? { ...(data as object), aviso_para_voce: "Essas opções também aparecerão como lista clicável pro cliente. Sua resposta em texto pode ser curta, tipo 'Encontrei esses horários, escolhe um aí 👇' — sem precisar listar cada um por escrito." }
        : data;
    return { resultado: JSON.stringify(resultadoComDica), handoff: false, slots };
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
    return { resultado: JSON.stringify(data), handoff: false, reservaFeita: Boolean((data as { ok?: boolean })?.ok) };
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
    return { resultado: JSON.stringify(data), handoff: false, reservaFeita: Boolean((data as { ok?: boolean })?.ok) };
  }

  if (nome === "consultar_avisos_ativos") {
    const { data, error } = await supabase.rpc("ia_consultar_avisos_ativos", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
    });
    if (error) return { resultado: JSON.stringify({ erro: error.message }), handoff: false };
    return { resultado: JSON.stringify(data), handoff: false };
  }

  if (nome === "consultar_catalogo") {
    const { data, error } = await supabase.rpc("ia_consultar_catalogo", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
      p_busca: input.busca,
    });
    if (error) return { resultado: JSON.stringify({ erro: error.message }), handoff: false };
    return { resultado: JSON.stringify(data), handoff: false };
  }

  if (nome === "solicitar_pagamento_pix") {
    try {
      const valorReais = Number(input.valor_reais);
      const pix = await createPixPaymentIntent({
        valorCentavos: Math.round(valorReais * 100),
        descricao: String(input.descricao ?? "Sinal"),
      });
      return {
        resultado: JSON.stringify({
          ok: true,
          pix_copia_e_cola: pix.pixCopiaECola,
          aviso_para_voce: "Manda esse código pro cliente exatamente como veio, dizendo pra colar no Pix Copia e Cola do banco dele.",
        }),
        handoff: false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao gerar Pix";
      return {
        resultado: JSON.stringify({
          erro: "pix_indisponivel",
          detalhe: msg,
          aviso_para_voce: "Pix ainda não está habilitado pro negócio. Explique ao cliente que o pagamento online não está disponível ainda e ofereça alternativa (pagar no local, ou chamar um humano).",
        }),
        handoff: false,
      };
    }
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
  imagemAnexada?: { base64: string; mediaType: string },
): Promise<ResultadoIA> {
  const system = montarSystemPrompt(ctx);

  const messages: ClaudeMessage[] = ctx.historico.map((m) => ({
    role: m.remetente === "contato" ? "user" : "assistant",
    content: m.conteudo,
  }));

  // A mensagem atual do cliente é sempre a última do histórico (foi
  // inserida antes desse RPC devolver). Se veio com imagem, troca o
  // conteúdo dela por um bloco multimodal — Claude recebe imagem nativo,
  // ao contrário de áudio (que precisa de transcrição antes de chegar aqui).
  if (imagemAnexada) {
    const ultima = messages[messages.length - 1];
    if (ultima?.role === "user") {
      const textoOriginal = typeof ultima.content === "string" ? ultima.content : "";
      ultima.content = [
        { type: "image", source: { type: "base64", media_type: imagemAnexada.mediaType, data: imagemAnexada.base64 } },
        ...(textoOriginal ? ([{ type: "text", text: textoOriginal }] as const) : []),
      ] as ClaudeContentBlock[];
    }
  }

  let handoffSolicitado = false;
  let opcoesHorario: Slot[] | undefined;

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
      return { resposta: texto || "Certo!", handoffSolicitado, opcoesHorario };
    }

    messages.push({ role: "assistant", content: resposta.content });

    // Executa cada ferramenta que o modelo chamou e devolve o resultado no
    // formato tool_result que a Messages API exige na próxima rodada.
    const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
    for (const bloco of blocosFerramenta) {
      const { resultado, handoff, slots, reservaFeita } = await executarFerramenta(
        bloco.name,
        bloco.input,
        ctx,
        secret,
        supabaseUrl,
        anonKey,
      );
      if (handoff) handoffSolicitado = true;
      // Só guarda a última lista de horários oferecida; se depois disso o
      // cliente já agendou/remarcou/cancelou, a lista velha não faz mais
      // sentido de reenviar.
      if (slots && slots.length > 0) opcoesHorario = slots;
      if (reservaFeita) opcoesHorario = undefined;
      toolResults.push({ type: "tool_result", tool_use_id: bloco.id, content: resultado });
    }

    messages.push({ role: "user", content: toolResults as unknown as ClaudeContentBlock[] });
  }

  return {
    resposta: "Só um instante que já te retorno.",
    handoffSolicitado: true, // não convergiu em MAX_TOOL_TURNS — melhor jogar pra humano do que ficar em loop
  };
}

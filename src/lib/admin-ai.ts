// Motor de IA do canal do dono — comandos administrativos via WhatsApp
// (criar promoção, chamar cliente, disparar upsell em massa, resumo do
// dia, pausar/retomar bot). Espelha a estrutura de ai.ts, mas fica num
// arquivo isolado de propósito: as ferramentas daqui têm poder bem maior
// (mandam mensagem em massa, pausam o atendimento inteiro) e nunca devem
// se misturar com as ferramentas do cliente.

import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText, sendWhatsAppTemplate, type WhatsAppCreds } from "@/lib/whatsapp";
import { podeEnviarAutomatico } from "@/lib/automacao";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const MAX_TOOL_TURNS = 4;

export type AdminContexto = {
  tenantId: string;
  tenantNome: string;
  upsellTemplateNome: string | null;
};

function headers() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("IA não configurada (falta ANTHROPIC_API_KEY)");
  return { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" };
}

function montarSystemPromptAdmin(ctx: AdminContexto) {
  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return [
    `Você é o assistente de gestão do dono de "${ctx.tenantNome}" — fala com o DONO do negócio, não com um cliente. Tom direto, prático, sem enrolação.`,
    `Agora é ${agora} (horário de Brasília). Use isso pra resolver datas relativas ("hoje", "domingo", "daqui a 2 semanas") sozinho, em vez de perguntar — só confirme com o dono se a data ficar genuinamente ambígua.`,
    `Suas ferramentas afetam o negócio de verdade (criam promoção pra todos os clientes verem, mandam mensagem em nome do negócio, podem pausar o atendimento automático inteiro). Use com cuidado.`,
    `Pra criar_promocao, precisa de: texto da promoção, data de início e data de fim (formato AAAA-MM-DD). Pergunte o que faltar.`,
    `Pra chamar_cliente: se a busca encontrar mais de um cliente, PERGUNTE qual (mostre nome e telefone de cada) antes de mandar qualquer coisa — nunca escolha um cliente sozinho quando há ambiguidade.`,
    `Pra upsell em massa: SEMPRE chame prever_upsell_em_massa primeiro e mostre a contagem de quantos clientes seriam afetados pro dono. Só chame disparar_upsell_em_massa depois que o dono confirmar explicitamente (algo como "sim", "pode mandar", "manda"). Nunca dispare sem essa confirmação explícita na mesma conversa.`,
    `Se disparar_upsell_em_massa ou chamar_cliente voltar com erro "fora_da_janela_24h_precisa_template" ou "sem_template_configurado", explique pro dono, em termos simples, que mensagens iniciadas pelo negócio (não é resposta a algo que o cliente mandou) só funcionam com um template de mensagem aprovado pela Meta — e que isso é configurado em Conta > Configurações do robô, e aprovado pela própria Meta (não é algo que resolve na hora).`,
    `Se voltar com erro "automacoes_pausadas_por_qualidade", explique que a Meta sinalizou queda na qualidade do número e o ivva pausou os disparos automáticos por 48h como proteção — o atendimento aos clientes continua normal, só as mensagens que o negócio inicia por conta própria estão pausadas por segurança.`,
    `Responda sempre em português do Brasil, mensagens curtas como no WhatsApp.`,
  ].join("\n\n");
}

const TOOLS = [
  {
    name: "criar_promocao",
    description: "Cadastra uma promoção que a IA de atendimento vai avisar proativamente pros clientes durante o período de vigência.",
    input_schema: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Texto da promoção" },
        data_inicio: { type: "string", description: "AAAA-MM-DD" },
        data_fim: { type: "string", description: "AAAA-MM-DD" },
        profissional_id: { type: "string", description: "Se a promoção for só de um profissional específico" },
      },
      required: ["texto", "data_inicio", "data_fim"],
    },
  },
  {
    name: "chamar_cliente",
    description: "Busca um cliente por nome ou telefone e manda uma mensagem em nome do negócio. Se achar mais de um, pergunte qual antes de mandar.",
    input_schema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Nome ou telefone (ou parte) do cliente" },
        mensagem: { type: "string", description: "Mensagem a enviar" },
      },
      required: ["busca", "mensagem"],
    },
  },
  {
    name: "prever_upsell_em_massa",
    description: "Conta quantos clientes se encaixam num critério, SEM mandar nada ainda. Sempre chame antes de disparar_upsell_em_massa.",
    input_schema: {
      type: "object",
      properties: {
        servico_contem: { type: "string", description: "Filtra por serviço que contém esse texto (ex: 'coloração')" },
        dias_desde_ultimo_servico: { type: "integer", description: "Só clientes cujo último atendimento foi há pelo menos N dias" },
      },
    },
  },
  {
    name: "disparar_upsell_em_massa",
    description: "Manda a oferta pra todos os clientes que batem o critério — só chame depois que prever_upsell_em_massa foi mostrado e o dono confirmou explicitamente.",
    input_schema: {
      type: "object",
      properties: {
        servico_contem: { type: "string" },
        dias_desde_ultimo_servico: { type: "integer" },
      },
    },
  },
  {
    name: "ver_resumo_do_dia",
    description: "Mostra quantos agendamentos hoje, conversas novas nas últimas 24h e atendimentos esperando um humano.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "pausar_bot",
    description: "Pausa o atendimento automático — toda conversa nova (e as que já estavam com o robô) passam pra fila de atendimento humano. Use só quando o dono pedir claramente (ex: 'vou fechar', 'para o robô um pouco').",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "retomar_bot",
    description: "Volta o atendimento automático a funcionar pra conversas novas.",
    input_schema: { type: "object", properties: {} },
  },
] as const;

type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type ClaudeMessage = { role: "user" | "assistant"; content: string | ClaudeContentBlock[] };

async function chamarClaude(system: string, messages: ClaudeMessage[]) {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, messages, tools: TOOLS }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Falha ao chamar a IA");
  return data as { content: ClaudeContentBlock[]; stop_reason: string };
}

function ehErroDeJanela(msg: string) {
  return /24 hours|window|janela/i.test(msg);
}

async function executarFerramentaAdmin(
  nome: string,
  input: Record<string, unknown>,
  ctx: AdminContexto,
  secret: string,
  supabaseUrl: string,
  anonKey: string,
  creds: WhatsAppCreds,
): Promise<string> {
  const supabase = createClient(supabaseUrl, anonKey);

  const logar = (acaoTipo: string, detalhe: unknown, resultado: string) =>
    supabase.rpc("registrar_acao_admin", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
      p_comando_original: JSON.stringify(input),
      p_acao_tipo: acaoTipo,
      p_acao_detalhe: detalhe,
      p_resultado: resultado,
    });

  if (nome === "criar_promocao") {
    const { data, error } = await supabase.rpc("admin_criar_promocao", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
      p_texto: input.texto,
      p_data_inicio: input.data_inicio,
      p_data_fim: input.data_fim,
      p_professional_id: input.profissional_id ?? null,
    });
    const resultado = error ? { erro: error.message } : data;
    await logar("criar_promocao", input, JSON.stringify(resultado));
    return JSON.stringify(resultado);
  }

  if (nome === "chamar_cliente") {
    const { data: candidatosData } = await supabase.rpc("admin_buscar_cliente", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
      p_busca: input.busca,
    });
    const candidatos = (candidatosData ?? []) as { id: string; nome: string; telefone: string }[];

    if (candidatos.length === 0) return JSON.stringify({ erro: "nenhum_cliente_encontrado" });
    if (candidatos.length > 1) return JSON.stringify({ multiplos_encontrados: candidatos });

    const alvo = candidatos[0];

    // Mensagem iniciada pelo dono (não é resposta a cliente) — mesma
    // pausa de segurança do envio automático se a qualidade do número
    // caiu.
    if (!(await podeEnviarAutomatico(supabase, secret, { tenantId: ctx.tenantId }))) {
      const resultado = { erro: "automacoes_pausadas_por_qualidade" };
      await logar("chamar_cliente", { contact_id: alvo.id }, JSON.stringify(resultado));
      return JSON.stringify(resultado);
    }

    try {
      await sendWhatsAppText(creds, alvo.telefone, String(input.mensagem ?? ""));
      await supabase.rpc("registrar_evento", {
        p_secret: secret,
        p_tenant_id: ctx.tenantId,
        p_tipo: "admin_chamou_cliente",
        p_contact_id: alvo.id,
        p_detalhe: { mensagem: input.mensagem },
      });
      const resultado = { ok: true, enviado_para: alvo.nome };
      await logar("chamar_cliente", { contact_id: alvo.id, mensagem: input.mensagem }, JSON.stringify(resultado));
      return JSON.stringify(resultado);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const resultado = { erro: ehErroDeJanela(msg) ? "fora_da_janela_24h_precisa_template" : "falha_envio", detalhe: msg };
      await logar("chamar_cliente", { contact_id: alvo.id }, JSON.stringify(resultado));
      return JSON.stringify(resultado);
    }
  }

  if (nome === "prever_upsell_em_massa") {
    const { data, error } = await supabase.rpc("admin_contar_upsell_alvo", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
      p_servico_contem: input.servico_contem ?? null,
      p_dias_desde_ultimo_servico: input.dias_desde_ultimo_servico ?? null,
    });
    return JSON.stringify(error ? { erro: error.message } : data);
  }

  if (nome === "disparar_upsell_em_massa") {
    if (!ctx.upsellTemplateNome) {
      const resultado = {
        erro: "sem_template_configurado",
        explicacao: "Precisa cadastrar um template de mensagem aprovado pela Meta em Conta > Configurações do robô antes de disparar em massa.",
      };
      await logar("disparar_upsell_em_massa", input, JSON.stringify(resultado));
      return JSON.stringify(resultado);
    }

    if (!(await podeEnviarAutomatico(supabase, secret, { tenantId: ctx.tenantId }))) {
      const resultado = { erro: "automacoes_pausadas_por_qualidade" };
      await logar("disparar_upsell_em_massa", input, JSON.stringify(resultado));
      return JSON.stringify(resultado);
    }

    const { data: alvosData } = await supabase.rpc("admin_listar_upsell_alvo", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
      p_servico_contem: input.servico_contem ?? null,
      p_dias_desde_ultimo_servico: input.dias_desde_ultimo_servico ?? null,
    });
    const alvos = (alvosData ?? []) as { contact_id: string; telefone: string; nome: string }[];

    let enviados = 0;
    let falhas = 0;
    for (const alvo of alvos) {
      try {
        await sendWhatsAppTemplate(creds, alvo.telefone, ctx.upsellTemplateNome);
        enviados++;
        await supabase.rpc("registrar_evento", {
          p_secret: secret,
          p_tenant_id: ctx.tenantId,
          p_tipo: "upsell_disparado",
          p_contact_id: alvo.contact_id,
          p_detalhe: {},
        });
      } catch {
        falhas++;
      }
    }

    const resultado = { ok: true, total: alvos.length, enviados, falhas };
    await logar("disparar_upsell_em_massa", input, JSON.stringify(resultado));
    return JSON.stringify(resultado);
  }

  if (nome === "ver_resumo_do_dia") {
    const { data, error } = await supabase.rpc("admin_resumo_do_dia", { p_secret: secret, p_tenant_id: ctx.tenantId });
    return JSON.stringify(error ? { erro: error.message } : data);
  }

  if (nome === "pausar_bot" || nome === "retomar_bot") {
    await supabase.rpc("admin_pausar_bot", {
      p_secret: secret,
      p_tenant_id: ctx.tenantId,
      p_pausar: nome === "pausar_bot",
    });
    await logar(nome, {}, JSON.stringify({ ok: true }));
    return JSON.stringify({ ok: true });
  }

  return JSON.stringify({ erro: "ferramenta_desconhecida" });
}

export async function gerarRespostaAdmin(
  ctx: AdminContexto,
  secret: string,
  supabaseUrl: string,
  anonKey: string,
  creds: WhatsAppCreds,
  historico: { remetente: "admin" | "bot"; conteudo: string }[],
): Promise<{ resposta: string }> {
  const system = montarSystemPromptAdmin(ctx);

  const messages: ClaudeMessage[] = historico.map((m) => ({
    role: m.remetente === "admin" ? "user" : "assistant",
    content: m.conteudo,
  }));

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
      return { resposta: texto || "Feito." };
    }

    messages.push({ role: "assistant", content: resposta.content });

    const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
    for (const bloco of blocosFerramenta) {
      const resultado = await executarFerramentaAdmin(bloco.name, bloco.input, ctx, secret, supabaseUrl, anonKey, creds);
      toolResults.push({ type: "tool_result", tool_use_id: bloco.id, content: resultado });
    }

    messages.push({ role: "user", content: toolResults as unknown as ClaudeContentBlock[] });
  }

  return { resposta: "Deixa eu terminar de processar isso — me chama de novo em instantinho." };
}

// Diagnóstico do cliente: perguntas do popup obrigatório do 1º acesso (negócios criados a partir de 24/11/2026)
// e o formato do relatório que a IA monta para o time de implantação (/admin/clientes).
// Mudou uma pergunta? O relatório lê pelo "id", então mantenha os ids estáveis.

export type Pergunta =
  | { id: string; rotulo: string; tipo: "texto"; placeholder?: string; obrigatoria?: boolean; longo?: boolean }
  | { id: string; rotulo: string; tipo: "opcao"; opcoes: string[]; obrigatoria?: boolean }
  | { id: string; rotulo: string; tipo: "multi"; opcoes: string[]; max?: number; obrigatoria?: boolean };

export type Etapa = { titulo: string; subtitulo: string; perguntas: Pergunta[]; prioridades?: boolean };

export const PRIORIDADES = [
  "Atendimento 24h no WhatsApp",
  "Agenda organizada e lembretes",
  "Campanhas com 1 único botão",
  "Recuperar clientes sumidos",
  "Receber pagamentos e sinal (Pix)",
  "Controle de estoque",
  "Gravação de vídeos e conteúdo",
  "Estratégia contra os concorrentes",
  "Relatórios e números do negócio",
] as const;

export const ETAPAS_DIAGNOSTICO: Etapa[] = [
  {
    titulo: "Seu negócio",
    subtitulo: "Para a ivva falar a língua do seu negócio desde o primeiro dia.",
    perguntas: [
      { id: "cidade", rotulo: "Cidade e estado", tipo: "texto", placeholder: "Ex.: Belo Horizonte/MG", obrigatoria: true },
      { id: "instagram", rotulo: "Instagram ou site", tipo: "texto", placeholder: "@seunegocio" },
      { id: "tempo", rotulo: "Há quanto tempo o negócio existe?", tipo: "opcao", opcoes: ["Menos de 1 ano", "1 a 3 anos", "3 a 10 anos", "Mais de 10 anos"], obrigatoria: true },
      { id: "equipe", rotulo: "Quantas pessoas trabalham com você?", tipo: "opcao", opcoes: ["Só eu", "2 a 3", "4 a 10", "11 a 30", "Mais de 30"], obrigatoria: true },
      { id: "faturamento", rotulo: "Faturamento médio por mês", tipo: "opcao", opcoes: ["Até R$ 10 mil", "R$ 10 a 30 mil", "R$ 30 a 100 mil", "R$ 100 a 300 mil", "Mais de R$ 300 mil", "Prefiro não dizer"], obrigatoria: true },
      { id: "ticket", rotulo: "Quanto um cliente gasta, em média, por compra ou atendimento?", tipo: "texto", placeholder: "Ex.: R$ 150" },
    ],
  },
  {
    titulo: "Seus clientes",
    subtitulo: "Quem compra de você hoje e quantos clientes você quer ter.",
    perguntas: [
      { id: "clientes_ativos", rotulo: "Quantos clientes ativos você tem hoje?", tipo: "opcao", opcoes: ["Até 50", "50 a 200", "200 a 500", "500 a 2.000", "Mais de 2.000"], obrigatoria: true },
      { id: "novos_mes", rotulo: "Quantos clientes novos chegam por mês?", tipo: "opcao", opcoes: ["Até 10", "10 a 30", "30 a 100", "Mais de 100"], obrigatoria: true },
      { id: "meta_clientes", rotulo: "Quantos clientes novos por mês você quer ter daqui a 6 meses?", tipo: "texto", placeholder: "Ex.: 60 por mês", obrigatoria: true },
      { id: "perfil_clientes", rotulo: "Quem são seus principais clientes?", tipo: "texto", placeholder: "Ex.: mulheres de 25 a 45 anos, empresas da região, noivas...", longo: true },
      { id: "origem_clientes", rotulo: "De onde vêm seus clientes?", tipo: "multi", opcoes: ["Instagram", "Indicação", "Google", "WhatsApp", "Passam na frente", "iFood ou marketplaces", "Anúncios pagos", "Outro"], obrigatoria: true },
    ],
  },
  {
    titulo: "Seu atendimento hoje",
    subtitulo: "Como o WhatsApp funciona no seu dia a dia.",
    perguntas: [
      { id: "mensagens_dia", rotulo: "Quantas conversas no WhatsApp por dia?", tipo: "opcao", opcoes: ["Até 10", "10 a 30", "30 a 100", "Mais de 100"], obrigatoria: true },
      { id: "quem_responde", rotulo: "Quem responde hoje?", tipo: "opcao", opcoes: ["Eu mesmo(a)", "Uma pessoa da equipe", "Várias pessoas", "Ninguém fixo"], obrigatoria: true },
      { id: "perde_vendas", rotulo: "Você perde vendas por demorar a responder?", tipo: "opcao", opcoes: ["Sim, muitas", "Às vezes", "Quase nunca", "Não sei"], obrigatoria: true },
      { id: "sistema_atual", rotulo: "Usa algum sistema ou agenda hoje? Qual?", tipo: "texto", placeholder: "Ex.: agenda de papel, Google Agenda, Trinks..." },
    ],
  },
  {
    titulo: "Dores e objetivos",
    subtitulo: "O que mais pesa hoje e onde você quer chegar.",
    perguntas: [
      {
        id: "dores",
        rotulo: "Quais são as 3 maiores dores do negócio hoje?",
        tipo: "multi",
        max: 3,
        obrigatoria: true,
        opcoes: [
          "Demoro para responder",
          "Clientes somem e não voltam",
          "Faltas e cancelamentos na agenda",
          "Pouco cliente novo",
          "Não tenho tempo para postar",
          "Perco controle do estoque",
          "Calote ou pagamento atrasado",
          "Não sei meus números",
          "Concorrência cobrando menos",
        ],
      },
      { id: "dor_texto", rotulo: "Conte com suas palavras o que mais te incomoda", tipo: "texto", longo: true, placeholder: "Opcional" },
      { id: "objetivo", rotulo: "Onde você quer que o negócio esteja daqui a 12 meses?", tipo: "texto", longo: true, obrigatoria: true, placeholder: "Ex.: dobrar o faturamento, abrir a segunda unidade..." },
      { id: "expectativa", rotulo: "O que você espera que a ivva resolva primeiro?", tipo: "texto", longo: true, obrigatoria: true },
    ],
  },
  {
    titulo: "Suas prioridades",
    subtitulo: "Coloque em ordem do mais importante para o menos importante. É assim que vamos montar a sua implantação.",
    prioridades: true,
    perguntas: [{ id: "concorrentes", rotulo: "Quem são seus 2 ou 3 principais concorrentes? (nome ou @)", tipo: "texto", placeholder: "Ex.: @concorrente1, Loja X" }],
  },
];

export type Respostas = Record<string, string | string[]>;

/** Confere as obrigatórias de uma etapa. Devolve a mensagem do 1º erro ou null. */
export function erroDaEtapa(etapa: Etapa, r: Respostas): string | null {
  for (const p of etapa.perguntas) {
    if (!p.obrigatoria) continue;
    const v = r[p.id];
    const vazio = Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
    if (vazio) return `Responda: ${p.rotulo}`;
  }
  return null;
}

// ---- Relatório da IA -------------------------------------------------------------------------------------

export type RelatorioDiagnostico = {
  resumo: string;
  potencial: "alto" | "medio" | "baixo";
  maturidade: { nota: number; explicacao: string };
  dores: { dor: string; solucao: string; recurso: string }[];
  plano_recomendado: { plano: string; motivo: string };
  oportunidades: { oferta: string; motivo: string }[];
  implantacao: { semana_1: string[]; dias_8_30: string[]; dias_31_60: string[] };
  roteiro_reuniao: { abrir_com: string; perguntas: string[]; mostrar: string[] };
  riscos: string[];
  mensagem_whatsapp: string;
};

const SISTEMA_RELATORIO = `Você é o consultor de implantação da ivva, uma atendente com IA no WhatsApp para negócios locais brasileiros (responde, agenda, vende e recupera clientes 24h).
Você vai ler o diagnóstico que o dono do negócio respondeu ao entrar no sistema e montar um relatório para o time da ivva ler ANTES da reunião de implantação.

O que a ivva oferece (use só isto, não invente recursos nem preços):
- Essencial (R$ 297/mês, 300 conversas): chatbot no WhatsApp 24h, 1 calendário, CRM com funil, dashboard, base de conhecimento do nicho, campanhas.
- Profissional (R$ 447/mês, 700 conversas): tudo do Essencial + calendários por profissional, 2 acessos, comissão automática, SAC e avaliações, reengajamento e recall automático (recuperar clientes sumidos), fila de espera, controle de estoque, resposta por áudio, cancelamento pelo chat, Estúdio (diagnóstico de conteúdo e roteiros de vídeo).
- Completo (R$ 597/mês, 1.500 conversas): tudo do Profissional + administração pelo WhatsApp, sinal antecipado no Pix (reduz faltas), recibo automático.
- Plano anual = 2 meses grátis. Créditos avulsos: +100 conversas por R$ 59.
- Campanhas com 1 único botão para a base de clientes (aniversário, sumidos, promoções).

Devolva SOMENTE um objeto JSON válido, sem texto antes ou depois, neste formato:
{"resumo":"3 a 4 frases sobre quem é o negócio, tamanho, momento e o que quer","potencial":"alto|medio|baixo","maturidade":{"nota":1-10,"explicacao":"1 frase sobre o quanto o atendimento já é organizado"},"dores":[{"dor":"...","solucao":"como a ivva resolve, concreto","recurso":"nome do recurso"}],"plano_recomendado":{"plano":"Essencial|Profissional|Completo","motivo":"por que, ligado às respostas"},"oportunidades":[{"oferta":"o que oferecer a mais (plano acima, anual, créditos, Estúdio...)","motivo":"gatilho nas respostas"}],"implantacao":{"semana_1":["..."],"dias_8_30":["..."],"dias_31_60":["..."]},"roteiro_reuniao":{"abrir_com":"frase para abrir a reunião usando algo que ele disse","perguntas":["perguntas para aprofundar"],"mostrar":["telas ou recursos para mostrar, na ordem das prioridades dele"]},"riscos":["risco de cancelar ou de não usar e como evitar"],"mensagem_whatsapp":"mensagem curta e calorosa, assinada pelo Diego, convidando para a reunião de implantação de 30 min e citando 1 objetivo dele"}

Regras: português do Brasil, direto, sem jargão. Siga a ordem de prioridades que ele escolheu. "potencial" considera faturamento, equipe, volume de mensagens e encaixe com planos maiores. Nunca invente dados que não estão nas respostas; se faltar informação, diga o que perguntar na reunião.`;

/** Gera o relatório com o modelo barato (Haiku). Lança erro se a IA falhar ou devolver algo fora do formato. */
export async function gerarRelatorioDiagnostico(dados: {
  negocio: string;
  segmento: string | null;
  plano: string | null;
  respostas: Respostas;
}): Promise<RelatorioDiagnostico> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("IA não configurada (falta ANTHROPIC_API_KEY)");
  const modelo = process.env.ANTHROPIC_MODEL_BARATO ?? "claude-haiku-5-5";

  const linhas: string[] = [`Negócio: ${dados.negocio}`, `Segmento: ${dados.segmento ?? "não informado"}`, `Plano assinado: ${dados.plano ?? "não informado"}`, ""];
  for (const etapa of ETAPAS_DIAGNOSTICO) {
    linhas.push(`## ${etapa.titulo}`);
    for (const p of etapa.perguntas) {
      const v = dados.respostas[p.id];
      const txt = Array.isArray(v) ? v.join(", ") : String(v ?? "").trim();
      linhas.push(`- ${p.rotulo}: ${txt || "(não respondeu)"}`);
    }
    if (etapa.prioridades) {
      const ordem = Array.isArray(dados.respostas.prioridades) ? dados.respostas.prioridades : [];
      linhas.push(`- Prioridades em ordem (1 = mais importante): ${ordem.map((x, i) => `${i + 1}. ${x}`).join(" | ") || "(não ordenou)"}`);
    }
    linhas.push("");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 3000,
      system: SISTEMA_RELATORIO,
      messages: [{ role: "user", content: linhas.join("\n") }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`IA respondeu ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const corpo = (await res.json()) as { content?: { type: string; text?: string }[] };
  const texto = (corpo.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) throw new Error("IA não devolveu JSON");
  const r = JSON.parse(texto.slice(inicio, fim + 1)) as RelatorioDiagnostico;
  if (!r.resumo || !r.plano_recomendado) throw new Error("relatório incompleto");
  return r;
}

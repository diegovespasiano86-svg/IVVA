// Fonte única de verdade de "o que cada plano inclui" — usado tanto pra
// gating de UI (dashboard, páginas) quanto pra qualquer lógica de negócio
// que precise saber se um tenant tem direito a um recurso.
export type PlanoId = "essencial" | "profissional" | "completo";

export const PLANOS_ORDEM: PlanoId[] = ["essencial", "profissional", "completo"];

export const PLANO_LABEL: Record<PlanoId, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  completo: "Completo",
};

export type Recurso =
  | "calendarios_multiplos"
  | "comissao_automatica"
  | "sac_avaliacoes"
  | "reengajamento_automatico"
  | "fila_espera"
  | "cancelamento_pelo_chat"
  | "estoque"
  | "resposta_por_audio"
  | "admin_pelo_whatsapp"
  | "sinal_antecipado"
  | "recibo_automatico";

// Plano mínimo em que cada recurso passa a existir.
const RECURSO_PLANO_MINIMO: Record<Recurso, PlanoId> = {
  calendarios_multiplos: "profissional",
  comissao_automatica: "profissional",
  sac_avaliacoes: "profissional",
  reengajamento_automatico: "profissional",
  fila_espera: "profissional",
  cancelamento_pelo_chat: "profissional",
  estoque: "profissional",
  resposta_por_audio: "profissional",
  admin_pelo_whatsapp: "completo",
  sinal_antecipado: "completo",
  recibo_automatico: "completo",
};

// ---- Limite mensal de conversas atendidas pela IA ------------------------
// Fonte única dos números: o app envia esta tabela ao banco, que escolhe pelo
// plano do cliente (ver supabase-migrations/2026-10-05_limite_conversas_ia.sql).
// Mudou aqui? Mude também src/lib/site.ts do site (ivva-site) e o texto de /planos.
//
// "Conversa" = todas as respostas da IA para o mesmo cliente do negócio dentro de
// 24 horas. O mês é o mês-calendário (renova dia 1º) e soma o mês inteiro.
export const CONVERSAS_POR_PLANO: Record<PlanoId, number> = {
  essencial: 300,
  profissional: 700,
  completo: 1500,
};

// Respostas médias por conversa, só para mostrar a equivalência ("≈ 1.800 respostas").
export const RESPOSTAS_POR_CONVERSA_MEDIA = 6;

// Teto de respostas dentro de uma mesma conversa (24h): barra laços e abuso.
// Passou disso, a conversa vai para a equipe do negócio.
export const RESPOSTAS_POR_CONVERSA_MAX = 30;

// Depois que as conversas do plano e os créditos avulsos acabam, a IA ainda
// atende esta folga (% do limite do plano) para o atendimento não parar de uma vez.
// Zere para bloquear exatamente no limite.
export const FOLGA_PERCENTUAL = 20;

// Pacote de crédito avulso: não expira e é usado depois das conversas do plano.
export const PACOTE_AVULSO = { conversas: 100, valorCentavos: 5900 } as const;

export function limiteConversas(plano: string | null | undefined): number {
  return CONVERSAS_POR_PLANO[normalizarPlano(plano)];
}

export function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR");
}

function normalizarPlano(plano: string | null | undefined): PlanoId {
  return PLANOS_ORDEM.includes(plano as PlanoId) ? (plano as PlanoId) : "essencial";
}

export function temRecurso(plano: string | null | undefined, recurso: Recurso): boolean {
  const atual = PLANOS_ORDEM.indexOf(normalizarPlano(plano));
  const minimo = PLANOS_ORDEM.indexOf(RECURSO_PLANO_MINIMO[recurso]);
  return atual >= minimo;
}

export function planoMinimoPara(recurso: Recurso): PlanoId {
  return RECURSO_PLANO_MINIMO[recurso];
}

export function nomePlano(plano: string | null | undefined): string {
  return PLANO_LABEL[normalizarPlano(plano)];
}

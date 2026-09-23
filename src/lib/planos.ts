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

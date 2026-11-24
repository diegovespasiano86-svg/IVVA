// Operação do IVVA Estúdio: etapas do pedido e pastas de arquivos (usado no app e no /admin).

export const ETAPAS = [
  { id: "novo", label: "Novo" },
  { id: "coletando", label: "Coletando" },
  { id: "analise", label: "Em análise" },
  { id: "revisao", label: "Sua revisão" },
  { id: "entregue", label: "Entregue" },
  { id: "conversa", label: "Conversa marcada" },
  { id: "proposta", label: "Proposta" },
  { id: "fechado", label: "Fechado" },
  { id: "perdido", label: "Perdido" },
] as const;
export type EtapaId = (typeof ETAPAS)[number]["id"];
export const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map((e) => [e.id, e.label]));

/** Como o cliente vê a etapa (sem jargão interno). */
export const ETAPA_CLIENTE: Record<string, string> = {
  novo: "Recebido",
  coletando: "Lendo o seu mercado",
  analise: "Montando o plano",
  revisao: "Revisão final do time",
  entregue: "Pronto",
  conversa: "Conversa marcada",
  proposta: "Proposta enviada",
  fechado: "Projeto em andamento",
  perdido: "Encerrado",
};

export const PASTAS = [
  { id: "relatorio", label: "Relatórios" },
  { id: "roteiros", label: "Roteiros" },
  { id: "videos_editados", label: "Vídeos editados" },
  { id: "cronograma", label: "Cronograma de postagens" },
  { id: "outros", label: "Outros materiais" },
  { id: "enviados", label: "Enviados por você" },
] as const;
export type PastaId = (typeof PASTAS)[number]["id"];
export const PASTA_LABEL: Record<string, string> = Object.fromEntries(PASTAS.map((p) => [p.id, p.label]));

export const LIMITE_ARQUIVO_MB = 50;

/** Página de agendamento do Google (conversa de 25 min, seg. a sex., 10h às 20h). */
export const AGENDA_ESTUDIO = "https://calendar.app.google/GB1PkL4KdrudNkPC6";

export type PedidoEstudio = {
  id: string;
  criado_em: string;
  atualizado_em: string;
  tipo: string;
  etapa: string;
  origem: string;
  tenant_id: string | null;
  plano: string | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  negocio: string | null;
  respostas: Record<string, string> | null;
  instagram: string | null;
  concorrentes: string | null;
  periodo: string | null;
  objetivo: string | null;
  formatos: string | null;
  prazo_em: string | null;
  entregue_em: string | null;
  aberto_vezes: number;
  custo_centavos: number | null;
  valor_proposta_centavos: number | null;
  notas: string | null;
};

export type ArquivoEstudio = {
  id: string;
  criado_em: string;
  pedido_id: string | null;
  tenant_id: string;
  pasta: string;
  nome: string;
  path: string;
  tamanho: number | null;
  enviado_por: string;
};

/** Nome seguro para o caminho no Storage. */
export function nomeSeguro(nome: string) {
  const base = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return base.slice(-80) || "arquivo";
}

export function dataBR(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function reais(centavos: number | null) {
  if (centavos == null) return "-";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

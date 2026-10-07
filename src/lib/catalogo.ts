// Cálculos do catálogo usados tanto no servidor (análise) quanto no cliente (ficha técnica).
export type FichaItem = { insumo_id: string; quantidade: number };
export type CustoInsumo = { id: string; custo: number };

/** Custo dos insumos que um atendimento do serviço consome, segundo a ficha técnica. */
export function custoDaFicha(ficha: FichaItem[] | undefined, insumos: CustoInsumo[]): number {
  return (ficha ?? []).reduce((s, f) => s + f.quantidade * (insumos.find((i) => i.id === f.insumo_id)?.custo ?? 0), 0);
}

import type { Termos } from "@/lib/termos";

export type TipoItem = "servico" | "venda" | "insumo";

/** Nome do tipo de item no vocabulário do negócio (Serviço/Procedimento/Imóvel/Aula..., Produto/Prato, Insumo de uso). */
export function rotuloTipo(tipo: TipoItem, t: Termos): string {
  if (tipo === "servico") return t.servico;
  if (tipo === "venda") return t.produto === "Produto" ? "Produto de venda" : t.produto;
  return "Insumo de uso";
}

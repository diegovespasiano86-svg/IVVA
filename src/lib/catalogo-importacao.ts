// Regras puras da importação do catálogo: tipo, números em formato brasileiro e linha pronta.
// Sem dependência de servidor: roda no navegador (prévia) e no servidor (revalidação).

export type TipoItem = "servico" | "venda" | "insumo";

export type LinhaItem = {
  nome: string;
  tipo: TipoItem;
  categoria: string;
  preco: number;
  custo: number;
  estoque: number;
  minimo: number;
  duracao: number | null;
};

/** "1.234,56", "R$ 12,50", "12.5" e "12" viram número. Vazio ou texto sem número vira null. */
export function lerNumero(bruto: string | null | undefined): number | null {
  let s = String(bruto ?? "").replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Serviço, insumo ou produto de venda (padrão quando a coluna falta ou não é reconhecida). */
export function lerTipo(bruto: string | null | undefined): TipoItem {
  const s = String(bruto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/servi|procedimento|atendimento/.test(s)) return "servico";
  if (/insumo|material|consumo|uso/.test(s)) return "insumo";
  return "venda";
}

export function montarLinha(r: {
  nome?: string;
  tipo?: string;
  categoria?: string;
  preco?: string;
  custo?: string;
  estoque?: string;
  minimo?: string;
  duracao?: string;
}): LinhaItem | null {
  const nome = String(r.nome ?? "").trim().slice(0, 120);
  if (!nome) return null;
  const tipo = lerTipo(r.tipo);
  const preco = lerNumero(r.preco) ?? 0;
  const custo = lerNumero(r.custo) ?? 0;
  if (preco < 0 || preco > 1_000_000 || custo < 0 || custo > 1_000_000) return null;
  const semEstoque = tipo === "servico";
  return {
    nome,
    tipo,
    categoria: String(r.categoria ?? "").trim().slice(0, 60),
    preco: Math.round(preco * 100) / 100,
    custo: Math.round(custo * 100) / 100,
    estoque: semEstoque ? 0 : Math.max(0, Math.min(1_000_000, Math.floor(lerNumero(r.estoque) ?? 0))),
    minimo: semEstoque ? 0 : Math.max(0, Math.min(1_000_000, Math.floor(lerNumero(r.minimo) ?? 0))),
    duracao: tipo === "servico" ? Math.max(0, Math.min(1440, Math.floor(lerNumero(r.duracao) ?? 0))) || null : null,
  };
}

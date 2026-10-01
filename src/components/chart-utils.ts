// Utilitários dos gráficos (sem React, sem hooks): formatação pt-BR, escala
// "bonita" do eixo, curva monotônica e paletas. Pode ser importado tanto por
// componentes de servidor quanto de cliente.

export type Formato = "numero" | "brl" | "percentual";
export type Ponto = { rotulo: string; valor: number };

/**
 * Paleta categórica (identidade de série — donut, legendas). Ordem FIXA, nunca
 * ciclada. Validada com o script do skill dataviz sobre fundo branco (#fff):
 * faixa de luminosidade, croma, separação para daltonismo (pior par vizinho
 * ΔE 9,2) e visão normal (pior par ΔE 19,6), inclusive o par que fecha o anel
 * do donut (último ↔ primeiro). Três tons ficam abaixo de 3:1 de contraste,
 * por isso todo uso traz rótulo + valor visíveis (legenda), nunca só a cor.
 * Não muda com a cor de destaque do negócio (senão perderia a validação).
 */
export const CATEGORICA = [
  "#6d5be0", // roxo (ação da marca)
  "#1baf7a", // água
  "#eb6834", // laranja
  "#2a78d6", // azul
  "#eda100", // amarelo
  "#e87ba4", // magenta
] as const;
/** "Outros": neutro, para tudo que passar da 6ª categoria. */
export const COR_OUTROS = "#a8a3b3";

/**
 * Paleta SEQUENCIAL derivada do tema (magnitude): um só matiz, a cor de
 * destaque do negócio, do suave ao cheio. Muda sozinha com a personalização.
 */
export const TEMA = {
  forte: "var(--purple)",
  inicio: "var(--accent-a)",
  fim: "var(--accent-b)",
  suave: "color-mix(in srgb, var(--purple) 34%, #fff)",
  muitoSuave: "color-mix(in srgb, var(--purple) 12%, #fff)",
  degradeH: "linear-gradient(90deg, var(--accent-a), var(--accent-b))",
} as const;

/** Cores legadas da marca passadas por telas antigas que devem seguir o tema. */
const SEGUE_TEMA = new Set(["#8b7fe8", "#6d5be0"]);
/** Retorna a cor fixa pedida ou `null` quando o gráfico deve seguir o tema. */
export function corFixa(cor?: string): string | null {
  if (!cor) return null;
  return SEGUE_TEMA.has(cor.toLowerCase()) ? null : cor;
}

const nfInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const nfBrl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const nfBrlInt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const nfCompacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Valor completo (tooltip, legenda): 1.234 · R$ 1.234,50 · 12,5% */
export function formatarValor(n: number, formato: Formato = "numero"): string {
  if (formato === "brl") return nfBrl.format(n);
  if (formato === "percentual") return `${nfInt.format(n)}%`;
  return nfInt.format(n);
}

/** Valor curto (eixos, rótulos diretos): 1,2 mil · R$ 1,2 mil · 12% */
export function formatarCompacto(n: number, formato: Formato = "numero"): string {
  const abs = Math.abs(n);
  if (formato === "percentual") return `${nfInt.format(n)}%`;
  if (formato === "brl") return abs >= 1000 ? `R$ ${nfCompacto.format(n)}` : nfBrlInt.format(n);
  return abs >= 1000 ? nfCompacto.format(n) : nfInt.format(n);
}

/** Escala de eixo com passos "redondos" (1, 2, 2,5, 5 × 10ⁿ), começando em zero. */
export function escalaBonita(max: number, alvoTicks = 4): { max: number; ticks: number[] } {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] };
  const bruto = max / alvoTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / mag;
  const passo = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const topo = Math.ceil(max / passo - 1e-9) * passo;
  const ticks: number[] = [];
  for (let v = 0; v <= topo + passo / 2; v += passo) ticks.push(Number(v.toFixed(10)));
  return { max: topo, ticks };
}

type XY = { x: number; y: number };

function sinal(v: number) {
  return v < 0 ? -1 : 1;
}

/**
 * Curva cúbica monotônica (mesmo algoritmo do d3 `curveMonotoneX`):
 * suave, mas nunca passa acima do pico nem abaixo do vale (sem "overshoot").
 */
export function caminhoMonotono(p: XY[]): string {
  const n = p.length;
  if (n === 0) return "";
  const f = (v: number) => v.toFixed(2);
  if (n === 1) return `M${f(p[0].x)},${f(p[0].y)}`;
  if (n === 2) return `M${f(p[0].x)},${f(p[0].y)}L${f(p[1].x)},${f(p[1].y)}`;

  const t: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const h0 = p[i].x - p[i - 1].x;
    const h1 = p[i + 1].x - p[i].x;
    const s0 = h0 ? (p[i].y - p[i - 1].y) / h0 : 0;
    const s1 = h1 ? (p[i + 1].y - p[i].y) / h1 : 0;
    const q = h0 + h1 ? (s0 * h1 + s1 * h0) / (h0 + h1) : 0;
    t[i] = (sinal(s0) + sinal(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(q)) || 0;
  }
  const ponta = (a: XY, b: XY, tv: number) => {
    const h = b.x - a.x;
    return h ? (3 * (b.y - a.y) / h - tv) / 2 : tv;
  };
  t[0] = ponta(p[0], p[1], t[1]);
  t[n - 1] = ponta(p[n - 2], p[n - 1], t[n - 2]);

  let d = `M${f(p[0].x)},${f(p[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (p[i + 1].x - p[i].x) / 3;
    d += `C${f(p[i].x + dx)},${f(p[i].y + dx * t[i])},${f(p[i + 1].x - dx)},${f(p[i + 1].y - dx * t[i + 1])},${f(p[i + 1].x)},${f(p[i + 1].y)}`;
  }
  return d;
}

/** Índices de rótulos do eixo X distribuídos por igual (sempre 1º e último). */
export function indicesRotulos(n: number, maxRotulos: number): number[] {
  if (n <= 0) return [];
  const m = Math.max(2, Math.min(n, maxRotulos));
  if (n <= m) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>();
  for (let k = 0; k < m; k++) out.add(Math.round((k * (n - 1)) / (m - 1)));
  return [...out];
}

/** Resumo em português de uma série, para leitores de tela (aria-label). */
export function resumoSerie(pontos: Ponto[], formato: Formato = "numero"): string {
  if (pontos.length === 0) return "Sem dados.";
  const max = pontos.reduce((a, b) => (b.valor > a.valor ? b : a));
  const min = pontos.reduce((a, b) => (b.valor < a.valor ? b : a));
  const ult = pontos[pontos.length - 1];
  return (
    `${pontos.length} pontos, de ${pontos[0].rotulo} a ${ult.rotulo}. ` +
    `Máximo ${formatarValor(max.valor, formato)} em ${max.rotulo}; ` +
    `mínimo ${formatarValor(min.valor, formato)} em ${min.rotulo}; ` +
    `último ${formatarValor(ult.valor, formato)}.`
  );
}

/** Resumo de uma lista categórica (barras, donut). */
export function resumoLista(itens: Ponto[], formatar: (n: number) => string): string {
  if (itens.length === 0) return "Sem dados.";
  return itens.map((i) => `${i.rotulo}: ${formatar(i.valor)}`).join("; ") + ".";
}

/** Id seguro para usar em url(#...) a partir do useId do React. */
export function idSeguro(id: string): string {
  return "g" + id.replace(/[^a-zA-Z0-9_-]/g, "");
}

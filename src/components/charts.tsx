// Sistema de gráficos do ivva — SVG puro, sem biblioteca externa.
//
// Cor: magnitude usa um só matiz, a cor de destaque do negócio (var(--purple)
// / degradê var(--accent-a) → var(--accent-b)), então tudo muda junto com a
// personalização. Identidade (donut/legendas) usa a paleta categórica fixa e
// validada para daltonismo em chart-utils.ts. Status (StatusTile) é paleta à
// parte e nunca se mistura com séries.
//
// Os gráficos com interação (linha, barras verticais, rosca) são "use client";
// barras horizontais, sparkline, anel, vazio e esqueleto funcionam em servidor.
import { ListaBarras } from "@/components/barras";
import { CardVazio } from "@/components/chart-estados";
import { formatarValor, type Formato } from "@/components/chart-utils";

export { CardVazio, ChartSkeleton } from "@/components/chart-estados";
export { LineAreaChart } from "@/components/line-area-chart";
export { VBarChart } from "@/components/vbar-chart";
export { DonutChart } from "@/components/donut-chart";
export { Sparkline } from "@/components/sparkline";
export { ProgressRing } from "@/components/progress-ring";
export type { Formato } from "@/components/chart-utils";

// Barras horizontais — ranking (serviços, funil, etc.). `corDestaqueIdx` leva
// o degradê para aquela barra (ex.: etapa de fechamento do funil); sem ele,
// o destaque vai para a maior.
export function HBarList({
  itens,
  corDestaqueIdx,
  formato = "numero",
}: {
  itens: { rotulo: string; valor: number }[];
  corDestaqueIdx?: number;
  formato?: Formato;
}) {
  if (itens.length === 0) return <CardVazio texto="Sem dados suficientes ainda." />;
  return <ListaBarras itens={itens} formatar={(n) => formatarValor(n, formato)} destaqueIdx={corDestaqueIdx} colunaRotulo="104px" />;
}

// Ladrilho de status semântico (bom/atenção/crítico) — nunca usa a cor
// categórica, é uma paleta separada de estado.
export function StatusTile({
  label,
  valor,
  tom,
}: {
  label: string;
  valor: number | string;
  tom: "bom" | "atencao" | "critico" | "neutro";
}) {
  const cores: Record<string, string> = {
    bom: "var(--teal)",
    atencao: "var(--amber)",
    critico: "var(--coral)",
    neutro: "var(--ink)",
  };
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="font-display text-[21px] font-extrabold tabular-nums" style={{ color: cores[tom] }}>
        {valor}
      </p>
    </div>
  );
}

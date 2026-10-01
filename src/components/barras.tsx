import { CardVazio } from "@/components/chart-estados";
import { formatarValor, resumoLista, TEMA, type Formato } from "@/components/chart-utils";

type Item = { rotulo: string; valor: number };

/**
 * Linhas de barras horizontais (ranking). Uma cor só, a do tema: a barra em
 * destaque (a maior, ou `destaqueIdx`) leva o degradê; as demais um tom suave
 * da mesma cor. Hover e entrada animada só com CSS — funciona em servidor e
 * aceita `formatar` vindo de página de servidor.
 */
export function ListaBarras({
  itens,
  formatar,
  destaqueIdx,
  colunaRotulo = "minmax(80px,140px)",
}: {
  itens: Item[];
  formatar: (n: number) => string;
  destaqueIdx?: number;
  colunaRotulo?: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const total = itens.reduce((s, i) => s + Math.max(0, i.valor), 0);
  const idxDestaque = destaqueIdx ?? itens.reduce((mi, it, i) => (it.valor > itens[mi].valor ? i : mi), 0);

  return (
    <ul className="flex flex-col gap-1" aria-label={`Ranking: ${resumoLista(itens, formatar)}`}>
      {itens.map((item, i) => {
        const destaque = i === idxDestaque;
        const pct = total > 0 ? Math.round((item.valor / total) * 100) : 0;
        return (
          <li
            key={`${item.rotulo}-${i}`}
            className="chart-row grid items-center gap-3 rounded-[10px] px-2 py-1.5"
            style={{ gridTemplateColumns: `${colunaRotulo} 1fr auto` }}
            title={`${item.rotulo}: ${formatar(item.valor)} (${pct}% do total)`}
          >
            <span className={`truncate text-[12.5px] ${destaque ? "font-bold text-ink" : "font-semibold text-ink-soft"}`}>{item.rotulo}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-soft">
              <div
                className={`chart-grow-x h-full rounded-full ${destaque ? "" : "chart-bar-suave"}`}
                style={{
                  width: `${Math.max(3, (item.valor / max) * 100)}%`,
                  background: destaque ? TEMA.degradeH : TEMA.suave,
                  animationDelay: `${i * 45}ms`,
                }}
              />
            </div>
            <span className="flex min-w-[44px] items-baseline justify-end gap-1.5 text-right tabular-nums">
              <span className="chart-row-pct text-[11px] font-semibold text-ink-faint">{pct}%</span>
              <span className={`text-[12.5px] font-extrabold ${destaque ? "text-ink-deep" : "text-ink"}`}>{formatar(item.valor)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Lista de barras horizontais com valor formatado (ex.: R$). Uma cor só: o maior vai em degradê do tema. */
export default function Barras({
  itens,
  formatar,
  formato,
  vazio = "Sem dados nesse período ainda.",
}: {
  itens: Item[];
  formatar?: (n: number) => string;
  /** Alternativa a `formatar`: "numero" | "brl" | "percentual". */
  formato?: Formato;
  vazio?: string;
}) {
  if (itens.length === 0 || itens.every((i) => i.valor === 0)) {
    return <CardVazio texto={vazio} />;
  }
  const fmt = formatar ?? (formato ? (n: number) => formatarValor(n, formato) : (n: number) => String(n));
  return <ListaBarras itens={itens} formatar={fmt} />;
}

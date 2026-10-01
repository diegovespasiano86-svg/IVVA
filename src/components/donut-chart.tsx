"use client";

import { useState } from "react";
import { CATEGORICA, COR_OUTROS, formatarValor, resumoLista, type Formato } from "@/components/chart-utils";
import { CardVazio } from "@/components/chart-estados";

type Fatia = { rotulo: string; valor: number; cor?: string };

const MAX_FATIAS = 6;

function setor(cx: number, cy: number, R: number, r: number, a0: number, a1: number) {
  const span = a1 - a0;
  const f = (n: number) => n.toFixed(2);
  if (span >= Math.PI * 2 - 1e-6) {
    // anel inteiro (uma fatia só): dois círculos com evenodd
    return `M${f(cx + R)},${f(cy)}A${R},${R} 0 1 1 ${f(cx - R)},${f(cy)}A${R},${R} 0 1 1 ${f(cx + R)},${f(cy)}Z` +
      `M${f(cx + r)},${f(cy)}A${r},${r} 0 1 0 ${f(cx - r)},${f(cy)}A${r},${r} 0 1 0 ${f(cx + r)},${f(cy)}Z`;
  }
  const grande = span > Math.PI ? 1 : 0;
  const p = (rad: number, ang: number) => `${f(cx + rad * Math.cos(ang))},${f(cy + rad * Math.sin(ang))}`;
  return `M${p(R, a0)}A${R},${R} 0 ${grande} 1 ${p(R, a1)}L${p(r, a1)}A${r},${r} 0 ${grande} 0 ${p(r, a0)}Z`;
}

/**
 * Rosca (partes de um todo, ex.: formas de pagamento). Cores categóricas
 * validadas em ordem fixa, seguindo a ORDEM de entrada (a cor acompanha a
 * categoria, não o tamanho) — passe as mais importantes primeiro. Da 7ª em
 * diante vira "Outros". Legenda com rótulo, % e valor (nunca só a cor);
 * passar o mouse/foco numa fatia ou item da legenda destaca os dois.
 */
export function DonutChart({
  fatias,
  centro,
  formato = "numero",
  tamanho = 168,
}: {
  fatias: Fatia[];
  centro?: { valor: string | number; rotulo: string };
  formato?: Formato;
  tamanho?: number;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);

  const validas = fatias.filter((f) => f.valor > 0);
  if (validas.length === 0) return <CardVazio texto="Sem dados nesse período ainda." />;

  const lista: Required<Fatia>[] = validas.slice(0, validas.length > MAX_FATIAS ? MAX_FATIAS - 1 : MAX_FATIAS).map((f, i) => ({
    ...f,
    cor: f.cor ?? CATEGORICA[i],
  }));
  if (validas.length > MAX_FATIAS) {
    const resto = validas.slice(MAX_FATIAS - 1).reduce((s, f) => s + f.valor, 0);
    lista.push({ rotulo: "Outros", valor: resto, cor: COR_OUTROS });
  }
  const total = lista.reduce((s, f) => s + f.valor, 0);
  const fmt = (n: number) => formatarValor(n, formato);
  const pct = (v: number) => `${((v / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: v / total < 0.1 ? 1 : 0 })}%`;

  const S = tamanho;
  const c = S / 2;
  const R = c - 6; // folga para a fatia ativa crescer
  const r = R * 0.64;
  const INICIO = -Math.PI / 2;
  const acumulado = lista.map((_, i) => lista.slice(0, i).reduce((s, f) => s + f.valor, 0));
  const arcos = lista.map((f, i) => ({
    a0: INICIO + (acumulado[i] / total) * Math.PI * 2,
    a1: INICIO + ((acumulado[i] + f.valor) / total) * Math.PI * 2,
  }));

  const fa = ativo !== null ? lista[ativo] : null;
  const centroValor = fa ? fmt(fa.valor) : centro ? (typeof centro.valor === "number" ? fmt(centro.valor) : centro.valor) : fmt(total);
  const centroRotulo = fa ? `${fa.rotulo} · ${pct(fa.valor)}` : centro?.rotulo ?? "Total";

  return (
    <div className="chart-root flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="relative mx-auto shrink-0 sm:mx-0" style={{ width: S, height: S }}>
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`Distribuição: ${resumoLista(lista, (v) => `${fmt(v)} (${pct(v)})`)}`}>
          <g className="chart-pop">
            {lista.map((f, i) => {
              const sobre = ativo === i;
              return (
                <path
                  key={`${f.rotulo}-${i}`}
                  d={setor(c, c, sobre ? R + 5 : R, r, arcos[i].a0, arcos[i].a1)}
                  fillRule="evenodd"
                  stroke="var(--surface)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  style={{ fill: f.cor, opacity: ativo === null || sobre ? 1 : 0.38, transition: "opacity 160ms ease" }}
                  onPointerEnter={() => setAtivo(i)}
                  onPointerDown={() => setAtivo(i)}
                  onPointerLeave={() => setAtivo((a) => (a === i ? null : a))}
                />
              );
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center" aria-hidden="true">
          <span className="font-display font-extrabold leading-tight tabular-nums text-ink-deep" style={{ fontSize: String(centroValor).length > 10 ? 13 : String(centroValor).length > 7 ? 15 : 19 }}>{centroValor}</span>
          <span className="mt-0.5 line-clamp-2 text-[10.5px] font-semibold text-ink-faint">{centroRotulo}</span>
        </div>
      </div>

      <ul className="flex min-w-[190px] flex-1 flex-col gap-0.5" aria-label="Legenda">
        {lista.map((f, i) => (
          <li
            key={`${f.rotulo}-${i}`}
            tabIndex={0}
            className={`chart-focus flex cursor-default items-center gap-2.5 rounded-[9px] px-2 py-1.5 transition-colors ${ativo === i ? "bg-surface-soft" : ""}`}
            style={{ opacity: ativo === null || ativo === i ? 1 : 0.55 }}
            onPointerEnter={() => setAtivo(i)}
            onPointerLeave={() => setAtivo((a) => (a === i ? null : a))}
            onFocus={() => setAtivo(i)}
            onBlur={() => setAtivo(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: f.cor }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-soft">{f.rotulo}</span>
            <span className="text-[11.5px] font-semibold tabular-nums text-ink-faint">{pct(f.valor)}</span>
            <span className="min-w-[64px] text-right text-[12.5px] font-extrabold tabular-nums text-ink">{fmt(f.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

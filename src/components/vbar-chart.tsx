"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useLargura } from "@/components/chart-hooks";
import { formatarCompacto, formatarValor, idSeguro, resumoLista, TEMA, type Formato, type Ponto } from "@/components/chart-utils";
import { CardVazio } from "@/components/chart-estados";

/** Caminho de barra com topo arredondado e base reta (ancorada na linha de base). */
function barra(x: number, y: number, w: number, base: number) {
  const h = base - y;
  const r = Math.min(6, w / 2, h);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

/**
 * Barras verticais — distribuição por categoria (ex.: dia da semana).
 * A maior leva o degradê do tema e o rótulo de valor; as outras mostram o
 * valor ao passar o mouse, tocar ou navegar com as setas.
 */
export function VBarChart({
  itens,
  formato = "numero",
  altura = 160,
}: {
  itens: Ponto[];
  formato?: Formato;
  altura?: number;
}) {
  const uid = idSeguro(useId());
  const [ref, W] = useLargura<HTMLDivElement>(520);
  const [ativo, setAtivo] = useState<number | null>(null);

  if (itens.length === 0) return <CardVazio texto="Sem dados suficientes ainda." />;

  const H = altura;
  const TOPO = 22;
  const BASE = H - 22;
  const n = itens.length;
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const maxIdx = itens.reduce((mi, it, i) => (it.valor > itens[mi].valor ? i : mi), 0);
  const passo = W / n;
  const larg = Math.max(8, Math.min(44, passo * 0.58));

  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    let prox: number | null = null;
    if (e.key === "ArrowRight") prox = ativo === null ? 0 : Math.min(n - 1, ativo + 1);
    else if (e.key === "ArrowLeft") prox = ativo === null ? n - 1 : Math.max(0, ativo - 1);
    else if (e.key === "Home") prox = 0;
    else if (e.key === "End") prox = n - 1;
    else if (e.key === "Escape") return setAtivo(null);
    if (prox !== null) {
      e.preventDefault();
      setAtivo(prox);
    }
  };

  return (
    <div
      ref={ref}
      className="chart-focus chart-root relative"
      tabIndex={0}
      role="group"
      aria-label="Gráfico interativo: use as setas para percorrer as barras"
      onKeyDown={teclado}
      onBlur={() => setAtivo(null)}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" role="img" aria-label={resumoLista(itens, (v) => formatarValor(v, formato))}>
        <defs>
          <linearGradient id={`${uid}-b`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--accent-b)" }} />
            <stop offset="100%" style={{ stopColor: "var(--accent-a)" }} />
          </linearGradient>
        </defs>
        {itens.map((item, i) => {
          const x = i * passo + (passo - larg) / 2;
          const h = item.valor > 0 ? Math.max(3, (item.valor / max) * (BASE - TOPO)) : 0;
          const y = BASE - h;
          const destaque = i === maxIdx;
          const sobre = i === ativo;
          const mostrarValor = destaque || sobre;
          return (
            <g key={`${item.rotulo}-${i}`}>
              {sobre && <rect x={i * passo + 2} y={TOPO - 18} width={passo - 4} height={BASE - TOPO + 18} rx="8" fill="var(--purple)" opacity="0.05" />}
              {h > 0 ? (
                <path
                  d={barra(x, y, larg, BASE)}
                  className="chart-grow-y"
                  style={{
                    fill: destaque ? `url(#${uid}-b)` : sobre ? "color-mix(in srgb, var(--purple) 60%, #fff)" : TEMA.suave,
                    animationDelay: `${i * 40}ms`,
                    transition: "fill 160ms ease",
                  }}
                />
              ) : (
                <line x1={x} x2={x + larg} y1={BASE - 1} y2={BASE - 1} strokeWidth="2" strokeLinecap="round" style={{ stroke: TEMA.suave }} />
              )}
              {mostrarValor && (
                <text
                  x={x + larg / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={destaque ? "var(--ink-deep)" : "var(--ink)"}
                  className="tabular-nums"
                  pointerEvents="none"
                >
                  {sobre ? formatarValor(item.valor, formato) : formatarCompacto(item.valor, formato)}
                </text>
              )}
              <text
                x={i * passo + passo / 2}
                y={H - 5}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight={sobre || destaque ? 700 : 400}
                fill={sobre || destaque ? "var(--ink)" : "var(--ink-faint)"}
              >
                {item.rotulo}
              </text>
              {/* alvo de toque: a coluna inteira */}
              <rect
                x={i * passo}
                y={0}
                width={passo}
                height={H}
                fill="transparent"
                onPointerEnter={() => setAtivo(i)}
                onPointerDown={() => setAtivo(i)}
                onPointerLeave={() => setAtivo((a) => (a === i ? null : a))}
              />
            </g>
          );
        })}
        <line x1="0" x2={W} y1={BASE + 0.5} y2={BASE + 0.5} stroke="var(--ink)" strokeOpacity="0.16" />
      </svg>
      <p className="sr-only" aria-live="polite">
        {ativo !== null ? `${itens[ativo].rotulo}: ${formatarValor(itens[ativo].valor, formato)}` : ""}
      </p>
    </div>
  );
}

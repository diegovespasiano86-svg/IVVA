"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useLargura } from "@/components/chart-hooks";
import {
  caminhoMonotono,
  corFixa,
  escalaBonita,
  formatarCompacto,
  formatarValor,
  idSeguro,
  indicesRotulos,
  resumoSerie,
  type Formato,
  type Ponto,
} from "@/components/chart-utils";
import { CardVazio } from "@/components/chart-estados";

/**
 * Série temporal (área + linha). Curva monotônica, área em degradê da cor de
 * destaque, grade tracejada sutil, destaque do pico e do último ponto, cursor
 * com dica que acompanha mouse/toque/teclado e entrada animada.
 */
export function LineAreaChart({
  pontos,
  cor,
  formato = "numero",
  altura = 190,
  comparar,
}: {
  pontos: Ponto[];
  /** Cor fixa da série. Sem ela, o gráfico segue a cor de destaque do negócio. */
  cor?: string;
  formato?: Formato;
  /** Altura total do gráfico em px (padrão 190). */
  altura?: number;
  /** Série do período anterior (linha tracejada), alinhada por índice. */
  comparar?: Ponto[];
}) {
  const uid = idSeguro(useId());
  const [ref, W] = useLargura<HTMLDivElement>(640);
  const [ativo, setAtivo] = useState<number | null>(null);

  // Uma linha reta em zero não informa nada — melhor mostrar o vazio.
  if (pontos.length === 0 || pontos.every((p) => p.valor === 0)) {
    return <CardVazio texto="Sem dados nesse período ainda." />;
  }

  const temComp = !!comparar && comparar.length > 0;
  const fixa = corFixa(cor);
  const corLinha = fixa ?? `url(#${uid}-l)`;
  const corPonto = fixa ?? "var(--purple)";

  const H = altura;
  const TOPO = 24;
  const BASE = H - 24;
  const maxDado = Math.max(...pontos.map((p) => p.valor), ...(temComp ? comparar!.map((p) => p.valor) : [0]));
  const escala = escalaBonita(maxDado, H < 150 ? 3 : 4);
  const rotY = escala.ticks.map((t) => formatarCompacto(t, formato));
  const ESQ = Math.max(...rotY.map((r) => r.length)) * 6.3 + 12;
  const DIR = 12;
  const largPlot = Math.max(40, W - ESQ - DIR);
  const n = pontos.length;
  const xDe = (i: number) => (n === 1 ? ESQ + largPlot / 2 : ESQ + (i * largPlot) / (n - 1));
  const yDe = (v: number) => BASE - (v / escala.max) * (BASE - TOPO);

  const coords = pontos.map((p, i) => ({ x: xDe(i), y: yDe(p.valor) }));
  const linha = caminhoMonotono(coords);
  const area = `${linha}L${coords[n - 1].x.toFixed(2)},${BASE}L${coords[0].x.toFixed(2)},${BASE}Z`;
  const coordsComp = temComp ? comparar!.slice(0, n).map((p, i) => ({ x: xDe(i), y: yDe(p.valor) })) : [];
  const linhaComp = coordsComp.length > 1 ? caminhoMonotono(coordsComp) : "";

  const picoIdx = pontos.reduce((mi, p, i) => (p.valor > pontos[mi].valor ? i : mi), 0);
  const ultIdx = n - 1;
  const rotulosX = indicesRotulos(n, Math.max(2, Math.floor(largPlot / 74)));
  // rótulo direto: pico sempre; último só se não colidir com o pico
  const mostrarUlt = ultIdx !== picoIdx && Math.abs(coords[ultIdx].x - coords[picoIdx].x) > 56;

  const indiceDoX = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    if (n === 1) return 0;
    return Math.max(0, Math.min(n - 1, Math.round(((x - ESQ) / largPlot) * (n - 1))));
  };
  const mover = (e: PointerEvent<SVGRectElement>) => setAtivo(indiceDoX(e.clientX, e.currentTarget.ownerSVGElement ?? e.currentTarget));
  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    const atual = ativo ?? ultIdx;
    let prox: number | null = null;
    if (e.key === "ArrowRight") prox = Math.min(n - 1, ativo === null ? ultIdx : atual + 1);
    else if (e.key === "ArrowLeft") prox = Math.max(0, ativo === null ? ultIdx : atual - 1);
    else if (e.key === "Home") prox = 0;
    else if (e.key === "End") prox = ultIdx;
    else if (e.key === "Escape") return setAtivo(null);
    if (prox !== null) {
      e.preventDefault();
      setAtivo(prox);
    }
  };

  const a = ativo !== null ? coords[ativo] : null;
  const pa = ativo !== null ? pontos[ativo] : null;
  const pc = ativo !== null && temComp ? comparar![ativo] : undefined;
  const delta = pa && pc && pc.valor !== 0 ? ((pa.valor - pc.valor) / Math.abs(pc.valor)) * 100 : null;
  const resumo = resumoSerie(pontos, formato);
  const larguraDica = 210; // = max-width de .chart-tip: a dica nunca sai do cartão

  return (
    <div className="chart-root">
      {temComp && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="1" y1="3" x2="17" y2="3" strokeWidth="2.5" strokeLinecap="round" style={{ stroke: corPonto }} />
            </svg>
            Este período
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="1" y1="3" x2="17" y2="3" strokeWidth="1.75" strokeDasharray="3 3" strokeLinecap="round" stroke="var(--ink-faint)" />
            </svg>
            Período anterior
          </span>
        </div>
      )}
      <div
        ref={ref}
        className="chart-focus relative"
        tabIndex={0}
        role="group"
        aria-label="Gráfico interativo: use as setas para percorrer os pontos"
        onKeyDown={teclado}
        onBlur={() => setAtivo(null)}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" role="img" aria-label={resumo}>
          <defs>
            <linearGradient id={`${uid}-a`} gradientUnits="userSpaceOnUse" x1="0" y1={TOPO} x2="0" y2={BASE}>
              <stop offset="0%" style={{ stopColor: fixa ?? "var(--accent-b)", stopOpacity: 0.26 }} />
              <stop offset="70%" style={{ stopColor: fixa ?? "var(--accent-b)", stopOpacity: 0.06 }} />
              <stop offset="100%" style={{ stopColor: fixa ?? "var(--accent-b)", stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id={`${uid}-l`} gradientUnits="userSpaceOnUse" x1={ESQ} y1="0" x2={ESQ + largPlot} y2="0">
              <stop offset="0%" style={{ stopColor: "var(--accent-a)" }} />
              <stop offset="100%" style={{ stopColor: "var(--accent-b)" }} />
            </linearGradient>
          </defs>

          {/* grade horizontal tracejada + rótulos do eixo Y */}
          {escala.ticks.map((t, i) => {
            const y = yDe(t);
            return (
              <g key={t}>
                {i > 0 && <line x1={ESQ} x2={W - DIR} y1={y} y2={y} stroke="var(--ink)" strokeOpacity="0.07" strokeDasharray="2 4" />}
                <text x={ESQ - 8} y={y} dy="0.32em" textAnchor="end" fontSize="10.5" fill="var(--ink-faint)" className="tabular-nums">
                  {rotY[i]}
                </text>
              </g>
            );
          })}
          <line x1={ESQ} x2={W - DIR} y1={BASE} y2={BASE} stroke="var(--ink)" strokeOpacity="0.14" />

          {/* eixo X: poucos rótulos legíveis */}
          {rotulosX.map((i) => (
            <text
              key={i}
              x={coords[i].x}
              y={H - 6}
              textAnchor={n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize="10.5"
              fill="var(--ink-faint)"
            >
              {pontos[i].rotulo}
            </text>
          ))}

          {/* período anterior */}
          {linhaComp && (
            <path d={linhaComp} fill="none" stroke="var(--ink-faint)" strokeOpacity="0.7" strokeWidth="1.75" strokeDasharray="4 4" strokeLinecap="round" className="chart-fade" />
          )}

          {/* área + linha */}
          {n > 1 && <path d={area} fill={`url(#${uid}-a)`} className="chart-fade" />}
          {n > 1 && (
            <path
              d={linha}
              fill="none"
              pathLength={1}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="chart-draw"
              style={{ stroke: corLinha }}
            />
          )}

          {/* pico */}
          <g className="chart-fade-late">
            <circle cx={coords[picoIdx].x} cy={coords[picoIdx].y} r="3.5" fill="var(--surface)" strokeWidth="2" style={{ stroke: corPonto }} />
            <text
              x={coords[picoIdx].x}
              y={coords[picoIdx].y - 10}
              textAnchor={picoIdx === 0 && n > 1 ? "start" : picoIdx === n - 1 && n > 1 ? "end" : "middle"}
              fontSize="11"
              fontWeight="700"
              fill="var(--ink)"
              className="tabular-nums"
            >
              {formatarCompacto(pontos[picoIdx].valor, formato)}
            </text>
            {/* último ponto com halo */}
            <circle cx={coords[ultIdx].x} cy={coords[ultIdx].y} r="9" opacity="0.16" style={{ fill: corPonto }} className="chart-halo" />
            <circle cx={coords[ultIdx].x} cy={coords[ultIdx].y} r="4.5" stroke="var(--surface)" strokeWidth="2" style={{ fill: corPonto }} />
            {mostrarUlt && (
              <text x={coords[ultIdx].x} y={coords[ultIdx].y - 13} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--ink-soft)" className="tabular-nums">
                {formatarCompacto(pontos[ultIdx].valor, formato)}
              </text>
            )}
          </g>

          {/* cursor */}
          {a && (
            <g pointerEvents="none">
              <line x1={a.x} x2={a.x} y1={TOPO - 8} y2={BASE} stroke="var(--ink)" strokeOpacity="0.22" strokeWidth="1" />
              {pc && coordsComp[ativo!] && (
                <circle cx={coordsComp[ativo!].x} cy={coordsComp[ativo!].y} r="3.5" fill="var(--surface)" stroke="var(--ink-faint)" strokeWidth="1.75" />
              )}
              <circle cx={a.x} cy={a.y} r="5.5" stroke="var(--surface)" strokeWidth="2.5" style={{ fill: corPonto }} />
            </g>
          )}

          {/* área de captura maior que as marcas */}
          <rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill="transparent"
            style={{ touchAction: "pan-y", cursor: "crosshair" }}
            onPointerMove={mover}
            onPointerDown={mover}
            onPointerLeave={() => setAtivo(null)}
          />
        </svg>

        {a && pa && (
          <div
            className="chart-tip"
            style={
              a.x < W / 2
                ? { left: Math.max(0, Math.min(a.x + 14, W - larguraDica)), top: 0 }
                : { right: Math.max(0, Math.min(W - a.x + 14, W - larguraDica)), top: 0 }
            }
          >
            <p className="text-[11px] font-semibold text-ink-faint">{pa.rotulo}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13.5px] font-extrabold tabular-nums text-ink-deep">
              <span className="h-2 w-2 rounded-full" style={{ background: corPonto }} />
              {formatarValor(pa.valor, formato)}
            </p>
            {pc && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] tabular-nums text-ink-soft">
                <span className="h-0 w-2 border-t-[1.5px] border-dashed border-ink-faint" />
                Anterior: {formatarValor(pc.valor, formato)}
                {delta !== null && (
                  <span className={`font-bold ${delta >= 0 ? "text-teal" : "text-coral"}`}>
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
                  </span>
                )}
              </p>
            )}
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {pa ? `${pa.rotulo}: ${formatarValor(pa.valor, formato)}${pc ? `; período anterior ${formatarValor(pc.valor, formato)}` : ""}` : ""}
        </p>
      </div>
    </div>
  );
}

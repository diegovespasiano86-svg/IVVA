import { useId } from "react";
import { caminhoMonotono, corFixa, formatarValor, idSeguro, type Formato } from "@/components/chart-utils";

/**
 * Minigráfico de tendência, sem eixos (para dentro de KPI). Estica na largura
 * do contêiner; a linha mantém a espessura (non-scaling-stroke) e o ponto
 * final é HTML, então nunca deforma. Sem interação: funciona em servidor.
 */
export function Sparkline({
  valores,
  cor,
  altura = 32,
  formato = "numero",
  rotulo = "Tendência",
}: {
  valores: number[];
  /** Cor fixa. Sem ela, segue a cor de destaque do negócio. */
  cor?: string;
  altura?: number;
  formato?: Formato;
  /** Prefixo do texto para leitores de tela. */
  rotulo?: string;
}) {
  const uid = idSeguro(useId());
  if (valores.length < 2) return null;

  const fixa = corFixa(cor);
  const traco = fixa ?? "var(--purple)";
  const VW = 100;
  const PAD = 3;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const pts = valores.map((v, i) => ({
    x: (i * VW) / (valores.length - 1),
    y: max === min ? altura / 2 : PAD + (1 - (v - min) / faixa) * (altura - PAD * 2),
  }));
  const linha = caminhoMonotono(pts);
  const area = `${linha}L${VW},${altura}L0,${altura}Z`;
  const ult = pts[pts.length - 1];

  const primeiro = valores[0];
  const ultimo = valores[valores.length - 1];
  const variacao = primeiro !== 0 ? Math.round(((ultimo - primeiro) / Math.abs(primeiro)) * 100) : null;
  const aria =
    `${rotulo}: de ${formatarValor(primeiro, formato)} para ${formatarValor(ultimo, formato)}` +
    (variacao !== null ? ` (${variacao >= 0 ? "alta" : "queda"} de ${Math.abs(variacao)}%)` : "") +
    ` em ${valores.length} períodos.`;

  return (
    <div className="relative w-full" style={{ height: altura }} role="img" aria-label={aria}>
      <svg viewBox={`0 0 ${VW} ${altura}`} preserveAspectRatio="none" className="block h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-s`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: traco, stopOpacity: 0.2 }} />
            <stop offset="100%" style={{ stopColor: traco, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${uid}-s)`} className="chart-fade" />
        <path
          d={linha}
          fill="none"
          pathLength={1}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="chart-draw"
          style={{ stroke: traco }}
        />
      </svg>
      <span
        aria-hidden="true"
        className="chart-fade-late absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
        style={{ left: `${(ult.x / VW) * 100}%`, top: ult.y, background: traco }}
      />
    </div>
  );
}

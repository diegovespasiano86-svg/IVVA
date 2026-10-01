import { useId } from "react";
import { formatarValor, idSeguro, type Formato } from "@/components/chart-utils";

/**
 * Anel de progresso para metas/percentuais. Degradê do tema no arco, trilho
 * suave, ponta arredondada e percentual no centro. Ao bater a meta, o texto
 * diz "Meta atingida" (nunca só a cor). Sem interação: funciona em servidor.
 */
export function ProgressRing({
  valor,
  max,
  rotulo,
  formato = "numero",
  tamanho = 136,
}: {
  valor: number;
  max: number;
  rotulo: string;
  formato?: Formato;
  tamanho?: number;
}) {
  const uid = idSeguro(useId());
  const pctReal = max > 0 ? (valor / max) * 100 : 0;
  const pct = Math.max(0, Math.min(100, pctReal));
  const bateu = pctReal >= 100;
  const esp = Math.max(8, Math.round(tamanho * 0.085));
  const r = (tamanho - esp) / 2;
  const c = tamanho / 2;
  const pctTxt = `${Math.round(pctReal).toLocaleString("pt-BR")}%`;
  const detalhe = `${formatarValor(valor, formato)} de ${formatarValor(max, formato)}`;

  return (
    <div className="flex flex-col items-center gap-2" role="img" aria-label={`${rotulo}: ${pctTxt} (${detalhe})${bateu ? ", meta atingida" : ""}.`}>
      <div className="relative" style={{ width: tamanho, height: tamanho }}>
        <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden="true" className="-rotate-90">
          <defs>
            <linearGradient id={`${uid}-r`} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: "var(--accent-a)" }} />
              <stop offset="100%" style={{ stopColor: "var(--accent-b)" }} />
            </linearGradient>
          </defs>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-soft)" strokeWidth={esp} />
          {pct > 0 && (
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={`url(#${uid}-r)`}
              strokeWidth={esp}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${pct} 100`}
              className="chart-ring"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-[clamp(18px,4.5vw,26px)] font-extrabold leading-none tabular-nums text-ink-deep">{pctTxt}</span>
          <span className={`mt-1 whitespace-nowrap text-[9.5px] font-bold uppercase tracking-wide ${bateu ? "text-teal" : "text-ink-faint"}`}>{bateu ? "✓ Atingida" : "da meta"}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[12.5px] font-bold text-ink">{rotulo}</p>
        <p className="text-[11.5px] tabular-nums text-ink-faint">{detalhe}</p>
      </div>
    </div>
  );
}

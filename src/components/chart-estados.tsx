// Estados dos gráficos: vazio (compacto, com a onda da marca do EmptyState) e
// carregando (skeleton). Sem hooks: funciona em servidor e cliente.

export function CardVazio({ texto, titulo }: { texto: string; titulo?: string }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-[12px] bg-surface-soft/70 px-4 py-7 text-center">
      <svg aria-hidden="true" viewBox="0 0 120 40" className="pointer-events-none mb-2 w-[120px] text-purple opacity-40">
        <path
          d="M2 26c8 0 10-14 20-14s8 22 18 22 10-20 20-20 8 16 18 16 10-10 20-10 8 8 18 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1 6"
        />
      </svg>
      {titulo && <p className="text-[13px] font-extrabold text-ink">{titulo}</p>}
      <p className="max-w-[300px] text-[12.5px] text-ink-faint">{texto}</p>
    </div>
  );
}

/** Esqueleto de carregamento de um gráfico (usa a classe .skeleton). */
export function ChartSkeleton({ altura = 190, tipo = "linha" }: { altura?: number; tipo?: "linha" | "barras" | "donut" }) {
  if (tipo === "barras") {
    return (
      <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Carregando gráfico">
        {[92, 70, 54, 38].map((w) => (
          <div key={w} className="flex items-center gap-3">
            <div className="skeleton h-3 w-[90px]" />
            <div className="skeleton h-2.5 flex-1" style={{ maxWidth: `${w}%` }} />
            <div className="skeleton h-3 w-8" />
          </div>
        ))}
      </div>
    );
  }
  if (tipo === "donut") {
    return (
      <div className="flex items-center gap-5" role="status" aria-busy="true" aria-label="Carregando gráfico">
        <div className="skeleton h-[140px] w-[140px] shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-3" style={{ width: `${80 - i * 12}%` }} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col justify-end gap-2" style={{ height: altura }} role="status" aria-busy="true" aria-label="Carregando gráfico">
      <div className="skeleton flex-1 rounded-[12px]" />
      <div className="flex justify-between">
        <div className="skeleton h-2.5 w-10" />
        <div className="skeleton h-2.5 w-10" />
        <div className="skeleton h-2.5 w-10" />
      </div>
    </div>
  );
}

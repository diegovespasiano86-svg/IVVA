import { solicitarDemonstracao } from "./feature-lock-actions";

// Section bloqueada por plano: mostra a forma/local da funcionalidade
// (pra gerar curiosidade), nunca dado real do tenant, e oferece um jeito
// de pedir demonstração — que vira chamado e oportunidade de upsell.
export function FeatureLock({
  liberado,
  titulo,
  planoNecessario,
  variante = "cards",
  className,
  children,
}: {
  liberado: boolean;
  titulo: string;
  planoNecessario: string;
  variante?: "cards" | "chart" | "list";
  className?: string;
  children?: React.ReactNode;
}) {
  if (liberado) return <>{children}</>;

  return (
    <div
      className={`relative overflow-hidden rounded-[16px] border border-border bg-surface ${className ?? ""}`}
    >
      <div className="pointer-events-none select-none px-5 py-4.5 opacity-35 grayscale">
        <Esqueleto variante={variante} />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-surface/75 px-5 text-center backdrop-blur-[1.5px]">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-soft text-ink-faint">
          <svg className="icon" viewBox="0 0 24 24">
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <p className="text-[13px] font-bold text-ink">{titulo}</p>
        <p className="text-[11.5px] text-ink-faint">
          Disponível a partir do plano{" "}
          <span className="font-semibold text-ink-soft">{planoNecessario}</span>
        </p>
        <form action={solicitarDemonstracao}>
          <input type="hidden" name="recurso" value={titulo} />
          <button
            type="submit"
            className="btn mt-1 bg-purple px-3.5 py-2 text-[12px] text-white"
          >
            Pedir demonstração
          </button>
        </form>
      </div>
    </div>
  );
}

function Esqueleto({ variante }: { variante: "cards" | "chart" | "list" }) {
  if (variante === "chart") {
    return (
      <div>
        <div className="mb-3 h-3 w-32 rounded bg-ink-faint/40" />
        <div className="flex h-[120px] items-end gap-2">
          {[40, 70, 50, 90, 60, 80, 45].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-ink-faint/40"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (variante === "list") {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="h-3 w-28 rounded bg-ink-faint/40" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 rounded-[10px] bg-ink-faint/25" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2].map((i) => (
        <div key={i}>
          <div className="mb-2 h-2.5 w-16 rounded bg-ink-faint/40" />
          <div className="h-6 w-20 rounded bg-ink-faint/40" />
        </div>
      ))}
    </div>
  );
}

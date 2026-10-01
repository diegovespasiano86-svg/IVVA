import type { LucideIcon } from "lucide-react";
import CountUp from "@/components/count-up";

/** Indicador padrão (filete degradê da marca, elevação ao pairar, números alinhados). */
export default function KpiCard({
  label,
  value,
  numero,
  kind = "int",
  icon: Icon,
  accent,
  hint,
}: {
  label: string;
  /** texto já formatado (use quando não for um número simples) */
  value?: string;
  /** número que sobe animado até o valor */
  numero?: number;
  kind?: "int" | "brl";
  icon?: LucideIcon;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className={`card card-lift relative overflow-hidden px-5 py-4 ${accent ? "border-purple/35" : ""}`}>
      <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#2fbf9f] via-[#8b7fe8] to-[#ff6b5b] opacity-60" />
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ece9fc] text-purple">
            <Icon size={15} />
          </span>
        )}
      </div>
      <p className={`font-display text-[clamp(18px,5.2vw,28px)] font-extrabold leading-none tabular-nums whitespace-nowrap ${accent ? "text-purple" : ""}`}>
        {numero !== undefined ? <CountUp value={numero} kind={kind} /> : value}
      </p>
      {hint && <p className="mt-1.5 text-[12px] text-ink-soft">{hint}</p>}
    </div>
  );
}

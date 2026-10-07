import type { LucideIcon } from "lucide-react";

/** Cabeçalho padrão de toda tela: ícone em pastilha de vidro, título forte, ações à direita. */
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-gradient-to-br from-[#2fbf9f]/15 via-[#8b7fe8]/18 to-[#ff6b5b]/12 text-purple shadow-[0_8px_20px_-12px_rgba(109,91,224,0.6)]">
            <Icon size={21} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="no-accent text-[24px] font-extrabold leading-tight tracking-[-0.02em]">{title}</h1>
          {subtitle && <p className="text-[13.5px] text-ink-soft">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

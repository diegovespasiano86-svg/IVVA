import Link from "next/link";
import { CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";

const TONS = {
  danger: { box: "border-coral/25 bg-[#fdece9]", icon: "bg-coral text-white", texto: "text-[#8f2a1c]", Icon: CircleAlert },
  warn: { box: "border-amber/25 bg-[#fdf0dc]", icon: "bg-amber text-white", texto: "text-[#7a4a00]", Icon: TriangleAlert },
  info: { box: "border-blue/25 bg-[#e6eefc]", icon: "bg-blue text-white", texto: "text-[#1d4c9e]", Icon: Info },
} as const;

/** Aviso padrão: fundo suave, ícone em pastilha, ação à direita. Só o ponto pulsa, nunca o bloco. */
export default function Alert({
  tone = "info",
  icon,
  pulse,
  action,
  children,
}: {
  tone?: keyof typeof TONS;
  icon?: LucideIcon;
  pulse?: boolean;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const t = TONS[tone];
  const Icon = icon ?? t.Icon;
  return (
    <div role="status" className={`mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${t.box}`}>
      <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.icon}`}>
        <Icon size={16} />
        {pulse && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-coral/80" />}
      </span>
      <p className={`min-w-0 flex-1 text-[13px] font-semibold leading-snug ${t.texto}`}>{children}</p>
      {action && (
        <Link href={action.href} className="btn btn-secondary btn-sm shrink-0">
          {action.label}
        </Link>
      )}
    </div>
  );
}

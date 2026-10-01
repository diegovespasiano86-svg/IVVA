import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** Estado vazio com ícone, frase e próximo passo (com a onda da marca ao fundo). */
export default function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="relative overflow-hidden px-6 py-12 text-center">
      <svg aria-hidden="true" viewBox="0 0 120 40" className="pointer-events-none absolute left-1/2 top-4 w-[320px] -translate-x-1/2 opacity-[0.14]">
        <defs>
          <linearGradient id="ev" x1="0" x2="1">
            <stop offset="0" stopColor="#2FBF9F" />
            <stop offset="0.55" stopColor="#8B7FE8" />
            <stop offset="1" stopColor="#FF6B5B" />
          </linearGradient>
        </defs>
        <path d="M2 24c8 0 10-18 20-18s8 30 18 30 10-26 20-26 8 22 18 22 10-14 20-14 8 10 18 10" fill="none" stroke="url(#ev)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#2fbf9f]/15 via-[#8b7fe8]/20 to-[#ff6b5b]/12 text-purple">
        <Icon size={24} />
      </span>
      <p className="relative mt-3 text-[14.5px] font-extrabold">{title}</p>
      {text && <p className="relative mx-auto mt-1 max-w-[380px] text-[13px] text-ink-soft">{text}</p>}
      {action && (
        <Link href={action.href} className="btn btn-secondary btn-sm relative mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}

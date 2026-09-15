"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { NavItem, Role } from "@/lib/nav";
import { logout } from "@/app/(app)/actions";

function Icon({ d }: { d: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <path d={d} />
    </svg>
  );
}

export default function Sidebar({
  items,
  negocio,
  nome,
  role,
}: {
  items: NavItem[];
  negocio: string;
  nome: string;
  role: Role;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden w-[236px] shrink-0 flex-col gap-1 border-r border-border bg-surface px-3 py-5 md:flex">
        <div className="mb-4 flex items-center gap-2.5 px-2">
          <svg width="26" height="26" viewBox="0 0 34 34">
            <defs>
              <linearGradient id="lgSide" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2FBF9F" />
                <stop offset="0.55" stopColor="#8B7FE8" />
                <stop offset="1" stopColor="#FF6B5B" />
              </linearGradient>
            </defs>
            <rect width="34" height="34" rx="10" fill="url(#lgSide)" />
            <path
              d="M7 20c2 0 2.5-8 5-8s2 10 4.5 10 2.5-12 5-12 2 10 4.5 10"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="min-w-0">
            <p className="truncate font-display text-[14px] font-bold leading-tight">
              {negocio}
            </p>
            <p className="text-[11px] font-semibold text-ink-faint">
              {role === "dono" ? "Dono do negócio" : "Profissional"}
            </p>
          </div>
        </div>

        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
                active
                  ? "bg-ink text-white"
                  : "text-ink-soft hover:bg-surface-soft hover:text-ink"
              }`}
            >
              <Icon d={item.icon} />
              {item.label}
            </Link>
          );
        })}

        <div className="mt-auto flex items-center gap-2.5 border-t border-border px-2 pt-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-soft text-[13px] font-bold text-ink-soft">
            {nome.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold">{nome}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Sair"
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-soft hover:text-coral"
            >
              <svg className="icon" viewBox="0 0 24 24" width="16" height="16">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </nav>

      {/* Mobile top bar with nav select */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3 md:hidden">
        <select
          value={
            items.find((item) => pathname.startsWith(item.href))?.href ??
            items[0]?.href
          }
          onChange={(e) => router.push(e.target.value)}
          className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13.5px] font-semibold"
        >
          {items.map((item) => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>
        <form action={logout}>
          <button
            type="submit"
            title="Sair"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-ink-faint"
          >
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}

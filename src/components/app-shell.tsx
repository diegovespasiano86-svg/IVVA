"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import { logout } from "@/app/(app)/actions";
import { Logo } from "@/components/logo";
import MotionEffects from "@/components/motion-effects";
import Aparencia from "@/components/aparencia";
import { navGroupsForRole, type NavGroup, type Role } from "@/lib/nav";

const MOBILE_PRIORITY = ["inicio", "conversas", "agenda", "clientes"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// "menu fixo": só conveniência, guardada no navegador (funciona sem storage)
const PIN_KEY = "ivva:menu-fixo";
function subscribePin(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("ivva:pin", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("ivva:pin", cb);
  };
}
function readPin() {
  try {
    return localStorage.getItem(PIN_KEY) === "1";
  } catch {
    return false;
  }
}

function groupActive(pathname: string, g: NavGroup) {
  return g.items.some((i) => isActive(pathname, i.href));
}

export default function AppShell({
  role,
  negocio,
  nome,
  alertHrefs,
  roboStatus,
  children,
}: {
  role: Role;
  negocio: string;
  nome: string;
  /** hrefs com algo pedindo atenção (ponto vermelho) */
  alertHrefs: string[];
  /** estado real do robô (só o dono vê); null = não mostrar */
  roboStatus: "ativo" | "pausado" | "sem-whatsapp" | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const groups = useMemo(() => navGroupsForRole(role), [role]);

  const [hovered, setHovered] = useState(false);
  const pinned = useSyncExternalStore(subscribePin, readPin, () => false);
  const [open, setOpen] = useState<string | null>(null);
  // Menus suspensos valem só para a tela em que foram abertos: ao navegar
  // (pathname muda) fecham sozinhos, sem precisar de efeito.
  const [userMenuAt, setUserMenuAt] = useState<string | null>(null);
  const [moreAt, setMoreAt] = useState<string | null>(null);
  const [paletteAt, setPaletteAt] = useState<string | null>(null);
  const userMenu = userMenuAt === pathname;
  const moreOpen = moreAt === pathname;
  const paletteOpen = paletteAt === pathname;
  const setUserMenu = (v: boolean | ((p: boolean) => boolean)) =>
    setUserMenuAt((cur) => ((typeof v === "function" ? v(cur === pathname) : v) ? pathname : null));
  const setMoreOpen = (v: boolean) => setMoreAt(v ? pathname : null);
  const setPaletteOpen = (v: boolean | ((p: boolean) => boolean)) =>
    setPaletteAt((cur) => ((typeof v === "function" ? v(cur === pathname) : v) ? pathname : null));

  function togglePin() {
    try {
      localStorage.setItem(PIN_KEY, pinned ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event("ivva:pin"));
  }

  // Ctrl/Cmd+K abre a busca
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteAt((cur) => (cur === pathname ? null : pathname));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname]);

  const expanded = hovered || pinned;
  const activeGroupId = groups.find((g) => groupActive(pathname, g))?.id ?? null;
  const openId = open ?? activeGroupId;
  const hasAlert = (g: NavGroup) => g.items.some((i) => alertHrefs.includes(i.href));
  const firstAlert = alertHrefs[0];

  const top = groups.filter((g) => !g.bottom);
  const bottom = groups.filter((g) => g.bottom);

  const mobileMain = MOBILE_PRIORITY.map((id) => groups.find((g) => g.id === id)).filter(
    (g): g is NavGroup => !!g,
  );

  function renderGroup(g: NavGroup) {
    const Icon = g.icon;
    const active = g.id === activeGroupId;
    const single = g.items.length === 1;
    const isOpen = expanded && openId === g.id && !single;
    const rowClass = `relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors ${
      active ? "bg-gradient-to-r from-[#8b7fe8]/20 to-[#8b7fe8]/5 text-purple" : "text-ink-soft hover:bg-surface-soft hover:text-ink"
    }`;
    const inner = (
      <>
        {active && <span className="absolute -left-3 top-2 h-6 w-[3px] rounded-r bg-purple" />}
        <span className="relative flex shrink-0">
          <Icon size={20} strokeWidth={1.9} />
          {hasAlert(g) && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-coral ring-2 ring-white" />
          )}
        </span>
        <span className={`flex-1 truncate transition-opacity ${expanded ? "opacity-100" : "opacity-0"}`}>
          {g.label}
        </span>
        {!single && expanded && (
          <ChevronDown size={15} className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        )}
      </>
    );
    return (
      <div key={g.id}>
        {single ? (
          <Link href={g.items[0].href} className={rowClass} title={g.label} aria-current={active ? "page" : undefined}>
            {inner}
          </Link>
        ) : (
          <button
            type="button"
            className={rowClass}
            title={g.label}
            aria-expanded={isOpen}
            onClick={() => {
              if (!expanded) router.push(g.items[0].href);
              else setOpen(openId === g.id ? "" : g.id);
            }}
          >
            {inner}
          </button>
        )}
        {isOpen && (
          <div className="ml-[22px] mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
            {g.items.map((i) => {
              const a = isActive(pathname, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={a ? "page" : undefined}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-semibold ${
                    a ? "bg-surface-soft text-ink" : "text-ink-soft hover:bg-surface-soft hover:text-ink"
                  }`}
                >
                  <span className="truncate">{i.label}</span>
                  {alertHrefs.includes(i.href) && <span className="h-2 w-2 shrink-0 rounded-full bg-coral" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* ---------- topo ---------- */}
      <header className="sticky top-0 z-40 bg-ink-deep text-white print:hidden">
        <div className="flex h-14 items-center gap-3 px-4 md:px-5">
          <Link href="/dashboard" className="shrink-0" aria-label="ivva, ir para o início">
            <Logo tone="light" />
          </Link>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="mx-auto hidden h-9 w-full max-w-[420px] items-center gap-2 rounded-[10px] bg-white/10 px-3 text-[13px] text-white/70 hover:bg-white/15 md:flex"
          >
            <Search size={16} />
            <span className="flex-1 text-left">Buscar telas e ações</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold">Ctrl K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 md:hidden"
              aria-label="Buscar"
            >
              <Search size={19} />
            </button>
            {roboStatus && (
              <Link
                href={roboStatus === "sem-whatsapp" ? "/conta" : "/robo"}
                title={
                  roboStatus === "ativo"
                    ? "O robô está atendendo seus clientes"
                    : roboStatus === "pausado"
                      ? "Robô pausado: conversas novas vão direto para atendimento humano"
                      : "WhatsApp não conectado: o robô ainda não atende. Clique para conectar."
                }
                className="mr-1 hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-bold hover:bg-white/15 sm:flex"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    roboStatus === "ativo" ? "animate-pulse bg-[#3ddbb4]" : roboStatus === "pausado" ? "bg-[#ffb648]" : "bg-[#ff7a6b]"
                  }`}
                />
                {roboStatus === "ativo" ? "Robô ativo" : roboStatus === "pausado" ? "Robô pausado" : "WhatsApp desconectado"}
              </Link>
            )}
            <a
              href="https://ivva.app.br/contato"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
              aria-label="Ajuda"
              title="Ajuda"
            >
              <CircleHelp size={19} />
            </a>
            <Link
              href={firstAlert ?? "/dashboard"}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
              aria-label={alertHrefs.length ? "Há avisos pedindo atenção" : "Sem avisos"}
              title={alertHrefs.length ? "Há avisos pedindo atenção" : "Sem avisos"}
            >
              <Bell size={19} />
              {alertHrefs.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#ff5a4a] ring-2 ring-ink-deep" />
              )}
            </Link>

            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setUserMenu((v) => !v)}
                aria-expanded={userMenu}
                className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-3 pr-1 hover:bg-white/15"
              >
                <span className="hidden max-w-[160px] truncate text-[13px] font-semibold md:block">{negocio}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#2fbf9f] to-[#8b7fe8] text-[12.5px] font-extrabold text-white">
                  {nome.slice(0, 1).toUpperCase()}
                </span>
              </button>
              {userMenu && (
                <div className="absolute right-0 top-11 w-[230px] rounded-xl border border-border bg-surface p-2 text-ink shadow-[0_12px_32px_-8px_rgba(20,18,27,0.35)]">
                  <div className="border-b border-border px-3 pb-2.5 pt-1.5">
                    <p className="truncate text-[13px] font-bold">{nome}</p>
                    <p className="truncate text-[12px] text-ink-soft">
                      {negocio} · {role === "dono" ? "Dono" : "Profissional"}
                    </p>
                  </div>
                  {role === "dono" && (
                    <Link
                      href="/conta"
                      className="mt-1 block rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-soft hover:bg-surface-soft hover:text-ink"
                    >
                      Conta e assinatura
                    </Link>
                  )}
                  <Aparencia />
                  <form action={logout}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-coral hover:bg-[#fdece9]"
                    >
                      <LogOut size={15} /> Sair
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="h-[2px] w-full bg-gradient-to-r from-[#2fbf9f] via-[#8b7fe8] to-[#ff6b5b]" />
      </header>

      <div className="flex flex-1">
        {/* ---------- menu lateral (desktop) ---------- */}
        <div className={`relative hidden shrink-0 transition-[width] duration-200 md:block print:!hidden ${pinned ? "w-[248px]" : "w-[68px]"}`}>
          <div className="sticky top-[58px] z-30 h-[calc(100dvh-58px)]">
          <nav
            aria-label="Menu principal"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setHovered(false);
            }}
            className={`absolute inset-y-0 left-0 z-30 flex flex-col overflow-y-auto overflow-x-hidden border-r border-border px-3 py-4 backdrop-blur-xl transition-[width,box-shadow,background-color] duration-200 ${
              expanded ? "w-[248px] bg-white" : "w-[68px] bg-white/90"
            } ${expanded && !pinned ? "shadow-[8px_0_32px_-12px_rgba(20,18,27,0.25)]" : ""}`}
          >
            <div className="flex flex-col gap-1">{top.map(renderGroup)}</div>
            <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
              {bottom.map(renderGroup)}
              <button
                type="button"
                onClick={togglePin}
                title={pinned ? "Recolher menu" : "Fixar menu aberto"}
                className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-ink-faint hover:bg-surface-soft hover:text-ink"
              >
                {pinned ? <PanelLeftClose size={20} className="shrink-0" /> : <PanelLeftOpen size={20} className="shrink-0" />}
                <span className={`truncate transition-opacity ${expanded ? "opacity-100" : "opacity-0"}`}>
                  {pinned ? "Recolher menu" : "Fixar menu"}
                </span>
              </button>
            </div>
          </nav>
          </div>
        </div>

        {/* ---------- conteúdo ---------- */}
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 pb-24 pt-6 md:px-8 md:pb-8 md:pt-8"><div className="mx-auto w-full max-w-[1320px]">{children}</div></main>
      </div>

      {/* ---------- barra inferior (celular) ---------- */}
      <nav
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border print:hidden bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {mobileMain.map((g) => {
          const Icon = g.icon;
          const active = g.id === activeGroupId;
          return (
            <Link
              key={g.id}
              href={g.items[0].href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
                active ? "text-purple" : "text-ink-soft"
              }`}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {hasAlert(g) && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-coral" />}
              </span>
              {g.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-ink-soft"
        >
          <MoreHorizontal size={22} />
          Mais
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Todas as áreas">
          <button className="absolute inset-0 bg-ink-deep/50" aria-label="Fechar" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-surface p-4 pb-8">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[15px] font-extrabold">Todas as áreas</p>
              <button onClick={() => setMoreOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-soft" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            {groups.map((g) => {
              const Icon = g.icon;
              return (
                <div key={g.id} className="py-2">
                  <p className="mb-1 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                    <Icon size={15} /> {g.label}
                  </p>
                  {g.items.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      className={`flex min-h-[44px] items-center justify-between rounded-lg px-3 text-[14px] font-semibold ${
                        isActive(pathname, i.href) ? "bg-[#ece9fc] text-purple" : "text-ink"
                      }`}
                    >
                      {i.label}
                      {alertHrefs.includes(i.href) && <span className="h-2 w-2 rounded-full bg-coral" />}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <MotionEffects />
      {paletteOpen && <Palette groups={groups} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

/** Busca rápida (Ctrl+K): salta para qualquer tela. */
function Palette({ groups, onClose }: { groups: NavGroup[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo(
    () => groups.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, group: g.label }))),
    [groups],
  );
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return all;
    return all.filter((r) => `${r.label} ${r.group}`.toLowerCase().includes(n));
  }, [all, q]);

  useEffect(() => inputRef.current?.focus(), []);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Buscar">
      <button className="absolute inset-0 bg-ink-deep/50" aria-label="Fechar busca" onClick={onClose} />
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-2xl bg-surface shadow-[0_24px_64px_-12px_rgba(20,18,27,0.5)]">
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search size={18} className="text-ink-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && results[sel]) go(results[sel].href);
            }}
            placeholder="Para onde você quer ir?"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-[13.5px] text-ink-soft">Nada encontrado.</li>}
          {results.map((r, idx) => (
            <li key={r.href}>
              <button
                type="button"
                onMouseEnter={() => setSel(idx)}
                onClick={() => go(r.href)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[14px] font-semibold ${
                  idx === sel ? "bg-[#ece9fc] text-purple" : "text-ink"
                }`}
              >
                {r.label}
                <span className="text-[12px] font-semibold text-ink-faint">{r.group}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

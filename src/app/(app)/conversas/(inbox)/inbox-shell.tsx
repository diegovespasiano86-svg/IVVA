"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Clock, MessagesSquare, Search } from "lucide-react";

export type InboxItem = {
  id: string;
  nome: string;
  telefone: string | null;
  status: "bot" | "humano" | "encerrada";
  sac: boolean;
  previa: string | null;
  autor: "contato" | "bot" | "humano" | null;
  quando: string; // ISO da última atividade
  janelaAte: string | null; // ISO: última msg do cliente + 24h
  atribuidoA: string | null;
  atribuidoNome: string | null;
};

type Aba = "humano" | "minhas" | "bot" | "encerrada" | "todas";

function relativo(iso: string, now: number) {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

function janela(item: InboxItem, now: number) {
  if (item.status === "encerrada" || !item.janelaAte) return null;
  const ms = new Date(item.janelaAte).getTime() - now;
  if (ms <= 0) return { texto: "Janela fechada", tom: "neutral" as const };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const texto = h > 0 ? `${h} h restantes` : `${m} min restantes`;
  return { texto, tom: h < 3 ? ("warn" as const) : ("neutral" as const) };
}

const AUTOR_PREFIXO = { contato: "", bot: "Robô: ", humano: "Você: " } as const;

export default function InboxShell({
  items,
  meuId,
  children,
}: {
  items: InboxItem[];
  meuId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const selecionada = pathname.startsWith("/conversas/") ? pathname.split("/")[2] : null;

  const [aba, setAba] = useState<Aba>(() => (items.some((i) => i.status === "humano") ? "humano" : "todas"));
  const [q, setQ] = useState("");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  const contagem = useMemo(
    () => ({
      humano: items.filter((i) => i.status === "humano").length,
      minhas: meuId ? items.filter((i) => i.atribuidoA === meuId && i.status !== "encerrada").length : 0,
      bot: items.filter((i) => i.status === "bot").length,
      encerrada: items.filter((i) => i.status === "encerrada").length,
      todas: items.length,
    }),
    [items, meuId],
  );

  const visiveis = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((i) => {
      if (aba === "minhas") {
        if (!meuId || i.atribuidoA !== meuId || i.status === "encerrada") return false;
      } else if (aba !== "todas" && i.status !== aba) return false;
      if (!n) return true;
      return `${i.nome} ${i.telefone ?? ""}`.toLowerCase().includes(n);
    });
  }, [items, aba, q, meuId]);

  const ABAS: { id: Aba; label: string }[] = [
    { id: "humano", label: "Precisam de você" },
    { id: "minhas", label: "Minhas" },
    { id: "bot", label: "Com o robô" },
    { id: "encerrada", label: "Encerradas" },
    { id: "todas", label: "Todas" },
  ];

  return (
    <div className="-mx-4 -mb-24 -mt-6 flex h-[calc(100dvh-58px-64px)] overflow-hidden border-t border-border bg-surface md:-mx-8 md:-mb-8 md:-mt-8 md:h-[calc(100dvh-58px)]">
      {/* ---- lista ---- */}
      <section
        aria-label="Conversas"
        className={`${selecionada ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-border md:w-[360px]`}
      >
        <div className="border-b border-border px-4 pb-3 pt-4">
          <h1 className="text-[18px] font-extrabold">Caixa de atendimento</h1>
          <div className="relative mt-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="h-9 w-full rounded-[10px] border border-border bg-bg pl-9 pr-3 text-[13px]"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                aria-pressed={aba === a.id}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ${
                  aba === a.id ? "bg-ink-deep text-white" : "bg-surface-soft text-ink-soft hover:text-ink"
                }`}
              >
                {a.label}
                <span
                  className={`rounded-full px-1.5 text-[11px] ${
                    aba === a.id
                      ? "bg-white/20"
                      : a.id === "humano" && contagem.humano > 0
                        ? "bg-coral text-white"
                        : "bg-white"
                  }`}
                >
                  {contagem[a.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto">
          {visiveis.length === 0 && (
            <li className="px-6 py-14 text-center text-[13px] text-ink-faint">
              {items.length === 0
                ? "Nenhuma conversa ainda. Assim que o WhatsApp estiver conectado, elas aparecem aqui."
                : "Nenhuma conversa nesta aba."}
            </li>
          )}
          {visiveis.map((i) => {
            const j = now ? janela(i, now) : null;
            const ativa = selecionada === i.id;
            return (
              <li key={i.id}>
                <Link
                  href={`/conversas/${i.id}`}
                  aria-current={ativa ? "page" : undefined}
                  className={`flex gap-3 border-b border-border px-4 py-3.5 ${
                    ativa ? "bg-[#ece9fc]" : "hover:bg-surface-soft"
                  }`}
                >
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ece9fc] text-[13px] font-extrabold text-purple">
                    {i.nome.slice(0, 2).toUpperCase()}
                    {i.status === "humano" && (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-coral ring-2 ring-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-bold">{i.nome}</span>
                      <span className="shrink-0 text-[11px] text-ink-faint" suppressHydrationWarning>
                        {now ? relativo(i.quando, now) : ""}
                      </span>
                    </div>
                    <p className="truncate text-[12.5px] text-ink-soft">
                      {i.previa ? `${i.autor ? AUTOR_PREFIXO[i.autor] : ""}${i.previa}` : "Sem mensagens ainda."}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {i.status === "humano" && aba !== "humano" && <span className="badge badge-danger">Precisa de você</span>}
                      {i.status === "bot" && aba === "todas" && <span className="badge badge-success">Robô atendendo</span>}
                      {i.status === "encerrada" && aba === "todas" && <span className="badge badge-neutral">Encerrada</span>}
                      {i.sac && i.status !== "encerrada" && <span className="badge badge-warn">SAC</span>}
                      {i.atribuidoNome && i.status !== "encerrada" && <span className="badge badge-brand" title="Responsável pela conversa">{i.atribuidoA === meuId ? "Você" : i.atribuidoNome}</span>}
                      {j && (
                        <span className={`badge ${j.tom === "warn" ? "badge-warn" : "badge-neutral"}`} title="Janela de 24 h do WhatsApp: depois dela só é possível enviar modelos aprovados">
                          <Clock size={11} /> {j.texto}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- conversa aberta ---- */}
      <section className={`${selecionada ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-bg`}>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
      </section>
    </div>
  );
}

export function InboxVazio() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ece9fc] text-purple">
        <MessagesSquare size={26} />
      </span>
      <p className="text-[15px] font-extrabold">Selecione uma conversa</p>
      <p className="mt-1 max-w-[320px] text-[13px] text-ink-soft">
        Escolha um cliente na lista para ver o histórico completo, acompanhar o robô ou assumir o atendimento.
      </p>
    </div>
  );
}

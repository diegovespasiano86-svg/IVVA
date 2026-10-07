"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { atualizarAgendamento } from "./actions";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
  type Event as RBCEvent,
  type ToolbarProps,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar-styles.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { "pt-BR": ptBR },
});

// Sem isso a visão Dia/Semana abre rolada pra 00:00 — ninguém tem
// agendamento de madrugada, então começa já perto do horário comercial.
const ROLAR_PARA = new Date();
ROLAR_PARA.setHours(8, 0, 0, 0);

const MENSAGENS = {
  next: "Próximo",
  previous: "Anterior",
  today: "Hoje",
  month: "Mês",
  week: "Semana",
  day: "Dia",
  agenda: "Lista",
  date: "Data",
  time: "Hora",
  event: "Agendamento",
  noEventsInRange: "Nenhum agendamento nesse período.",
  showMore: (total: number) => `+${total} mais`,
};

// Toolbar própria — só navegação (hoje/anterior/próximo) e o rótulo do
// período. Os botões de visão (Dia/Semana/Mês) já existem no cabeçalho
// customizado acima, então a toolbar padrão da lib ficaria duplicada.
function ToolbarCustomizada({ label, onNavigate }: ToolbarProps) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex rounded-[10px] border border-border p-0.5">
        <button
          type="button"
          onClick={() => onNavigate("TODAY")}
          className="rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold text-ink-soft hover:bg-surface-soft"
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={() => onNavigate("PREV")}
          className="rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold text-ink-soft hover:bg-surface-soft"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onNavigate("NEXT")}
          className="rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold text-ink-soft hover:bg-surface-soft"
        >
          Próximo
        </button>
      </div>
      <p className="font-display text-[15px] font-bold capitalize">{label}</p>
    </div>
  );
}

export type EventoAgenda = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  cor: string;
  contato: string;
  contatoId: string | null;
  telefone: string | null;
  profissional: string;
  profissionalId: string | null;
  servico: string | null;
  status: string;
};

export default function CalendarView({
  eventos,
  profissionais,
  termos,
}: {
  eventos: EventoAgenda[];
  profissionais: { id: string; nome: string; cor: string }[];
  termos: { profissional: string; servico: string };
}) {
  const [view, setView] = useState<View | "year">(Views.WEEK);
  const [data, setData] = useState(new Date());
  const [selecionado, setSelecionado] = useState<EventoAgenda | null>(null);
  const [pendente, iniciar] = useTransition();
  const [passo, setPasso] = useState<"menu" | "cancelar" | "remarcar">("menu");
  const [novaData, setNovaData] = useState("");
  const [retorno, setRetorno] = useState<{ ok: boolean; texto: string } | null>(null);
  const fechar = () => {
    setSelecionado(null);
    setPasso("menu");
    setNovaData("");
    setRetorno(null);
  };
  const executar = (acao: "concluir" | "cancelar" | "remarcar") => {
    if (!selecionado) return;
    iniciar(async () => {
      const r = await atualizarAgendamento(selecionado.id, acao, acao === "remarcar" ? new Date(novaData).toISOString() : undefined);
      if (r.erro) setRetorno({ ok: false, texto: r.erro });
      else {
        setRetorno({ ok: true, texto: r.aviso ?? (acao === "concluir" ? "Atendimento concluído." : acao === "remarcar" ? "Horário remarcado." : "Horário cancelado.") });
        setTimeout(fechar, 1400);
      }
    });
  };
  const [maximizado, setMaximizado] = useState(false);

  const eventosRBC = useMemo<RBCEvent[]>(
    () =>
      eventos.map((e) => ({
        ...e,
        resource: e,
      })),
    [eventos],
  );

  const abas: { key: View | "year"; label: string }[] = [
    { key: Views.DAY, label: "Dia" },
    { key: Views.WEEK, label: "Semana" },
    { key: Views.MONTH, label: "Mês" },
    { key: "year", label: "Ano" },
  ];

  return (
    <div className={maximizado ? "fixed inset-0 z-50 flex flex-col bg-bg p-4" : ""}>
      <div
        className={`card px-4 py-4 ${maximizado ? "flex flex-1 flex-col overflow-hidden" : ""}`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-3">
            {profissionais.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.cor }} />
                {p.nome}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-[10px] border border-border p-0.5">
              {abas.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setView(a.key)}
                  className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                    view === a.key ? "bg-ink text-white" : "text-ink-soft hover:bg-surface-soft"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMaximizado((v) => !v)}
              title={maximizado ? "Minimizar" : "Maximizar"}
              className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border text-ink-soft hover:bg-surface-soft"
            >
              <svg className="icon" viewBox="0 0 24 24" width="15" height="15">
                {maximizado ? (
                  <path d="M9 3v4a2 2 0 0 1-2 2H3M21 8h-4a2 2 0 0 1-2-2V3M3 16h4a2 2 0 0 1 2 2v4M16 21v-4a2 2 0 0 1 2-2h4" />
                ) : (
                  <path d="M3 8V4a1 1 0 0 1 1-1h4M21 8V4a1 1 0 0 0-1-1h-4M3 16v4a1 1 0 0 0 1 1h4M21 16v4a1 1 0 0 1-1 1h-4" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {view === "year" ? (
          <VisaoAno
            data={data}
            eventos={eventos}
            onEscolherMes={(mes) => {
              setData(mes);
              setView(Views.MONTH);
            }}
          />
        ) : (
          <div
            className={maximizado ? "min-h-0 flex-1" : ""}
            style={maximizado ? undefined : { height: 640 }}
          >
            <Calendar
              localizer={localizer}
              culture="pt-BR"
              events={eventosRBC}
              view={view as View}
              date={data}
              onView={(v) => setView(v)}
              onNavigate={(d) => setData(d)}
              onSelectEvent={(e) => setSelecionado((e as { resource: EventoAgenda }).resource)}
              views={[Views.DAY, Views.WEEK, Views.MONTH]}
              scrollToTime={ROLAR_PARA}
              messages={MENSAGENS}
              components={{ toolbar: ToolbarCustomizada }}
              popup
              style={{ height: "100%" }}
              eventPropGetter={(e) => {
                const ev = (e as { resource: EventoAgenda }).resource;
                return {
                  style: {
                    backgroundColor: ev.cor,
                    borderColor: ev.cor,
                    opacity: ev.status === "concluido" ? 0.55 : 1,
                  },
                };
              }}
            />
          </div>
        )}
      </div>

      {selecionado && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/30 px-4"
          onClick={fechar}
        >
          <div
            className="card w-full max-w-[360px] px-5 py-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[14px] font-bold">
                <span className="h-3 w-3 rounded-full" style={{ background: selecionado.cor }} />
                {selecionado.contato}
              </span>
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="text-ink-faint hover:text-ink"
              >
                <svg className="icon" viewBox="0 0 24 24" width="16" height="16">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <dl className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-faint">{termos.servico}</dt>
                <dd className="font-semibold">{selecionado.servico ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">{termos.profissional}</dt>
                <dd className="font-semibold">{selecionado.profissional}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">Quando</dt>
                <dd className="font-semibold">
                  {selecionado.start.toLocaleDateString("pt-BR")} ·{" "}
                  {selecionado.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">Status</dt>
                <dd className="font-semibold capitalize">{selecionado.status}</dd>
              </div>
            </dl>

            {retorno && (
              <p role="status" className={`mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold ${retorno.ok ? "bg-teal/10 text-teal" : "bg-coral/10 text-coral"}`}>
                {retorno.texto}
              </p>
            )}

            {!retorno?.ok && passo === "menu" && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {selecionado.status !== "concluido" && (
                  <>
                    <Link
                      href={`/checkout?${new URLSearchParams({ appointment_id: selecionado.id, contact_id: selecionado.contatoId ?? "", professional_id: selecionado.profissionalId ?? "", servico: selecionado.servico ?? "" }).toString()}`}
                      className="btn btn-primary btn-md col-span-2 justify-center"
                    >
                      Concluir e receber
                    </Link>
                    <button type="button" disabled={pendente} onClick={() => executar("concluir")} className="col-span-2 text-center text-[12px] font-semibold text-ink-faint hover:text-ink disabled:opacity-60">
                      {pendente ? "Salvando…" : "Só marcar como concluído (sem cobrança)"}
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setPasso("remarcar")} className="btn btn-secondary btn-md justify-center">
                  Remarcar
                </button>
                <button type="button" onClick={() => setPasso("cancelar")} className="btn btn-secondary btn-md justify-center !text-coral">
                  Cancelar horário
                </button>
                {selecionado.contatoId && (
                  <Link href={`/clientes/${selecionado.contatoId}`} className="btn btn-secondary btn-md justify-center">
                    Abrir cliente
                  </Link>
                )}
                {selecionado.telefone && (
                  <a href={`https://wa.me/${selecionado.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-md justify-center">
                    WhatsApp
                  </a>
                )}
              </div>
            )}

            {!retorno?.ok && passo === "remarcar" && (
              <div className="mt-4 flex flex-col gap-2">
                <label htmlFor="nova-data" className="text-[12px] font-bold text-ink-soft">Nova data e hora</label>
                <input id="nova-data" type="datetime-local" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="input" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPasso("menu")} className="btn btn-secondary btn-md justify-center">Voltar</button>
                  <button type="button" disabled={pendente || !novaData} onClick={() => executar("remarcar")} className="btn btn-primary btn-md justify-center disabled:opacity-60">
                    {pendente ? "Salvando…" : "Confirmar"}
                  </button>
                </div>
              </div>
            )}

            {!retorno?.ok && passo === "cancelar" && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-[12.5px] text-ink-soft">Cancelar este horário? Se houver lista de espera, a próxima pessoa será avisada.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPasso("menu")} className="btn btn-secondary btn-md justify-center">Manter</button>
                  <button type="button" disabled={pendente} onClick={() => executar("cancelar")} className="btn btn-md justify-center bg-coral text-white disabled:opacity-60">
                    {pendente ? "Cancelando…" : "Sim, cancelar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// react-big-calendar não tem visão de ano nativa — grade simples de 12
// meses em miniatura, cada dia com agendamento marcado com um pontinho.
function VisaoAno({
  data,
  eventos,
  onEscolherMes,
}: {
  data: Date;
  eventos: EventoAgenda[];
  onEscolherMes: (mes: Date) => void;
}) {
  const ano = data.getFullYear();
  const meses = Array.from({ length: 12 }, (_, i) => new Date(ano, i, 1));

  const diasComEvento = useMemo(() => {
    const set = new Set<string>();
    for (const e of eventos) {
      set.add(format(e.start, "yyyy-MM-dd"));
    }
    return set;
  }, [eventos]);

  return (
    <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
      {meses.map((mes) => (
        <MiniMes key={mes.toISOString()} mes={mes} diasComEvento={diasComEvento} onClick={() => onEscolherMes(mes)} />
      ))}
    </div>
  );
}

function MiniMes({
  mes,
  diasComEvento,
  onClick,
}: {
  mes: Date;
  diasComEvento: Set<string>;
  onClick: () => void;
}) {
  const inicioMes = startOfMonth(mes);
  const diaSemanaInicio = getDay(inicioMes);
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celulas = [
    ...Array.from({ length: diaSemanaInicio }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[12px] border border-border px-3 py-3 text-left hover:border-purple hover:bg-purple/5"
    >
      <p className="mb-2 text-[12.5px] font-bold capitalize">
        {format(mes, "MMMM", { locale: ptBR })}
      </p>
      <div className="grid grid-cols-7 gap-[3px]">
        {celulas.map((dia, i) => {
          if (dia === null) return <span key={i} />;
          const chave = format(new Date(mes.getFullYear(), mes.getMonth(), dia), "yyyy-MM-dd");
          const temEvento = diasComEvento.has(chave);
          return (
            <span
              key={i}
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[8.5px] ${
                temEvento ? "bg-purple/15 font-bold text-purple" : "text-ink-faint"
              }`}
            >
              {dia}
            </span>
          );
        })}
      </div>
    </button>
  );
}

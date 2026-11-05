"use client";

import { useMemo, useState } from "react";
import { HORARIOS } from "@/lib/estudio-dados";

const PERGUNTAS: { id: string; rotulo: string; opcoes?: string[] }[] = [
  { id: "negocio", rotulo: "Qual é o seu negócio?" },
  { id: "busca", rotulo: "O que você busca com o Estúdio?", opcoes: ["Mais clientes", "Mais autoridade", "Vídeos prontos", "Site novo", "Ainda não sei"] },
  { id: "fatura", rotulo: "Faturamento mensal aproximado", opcoes: ["Até R$ 10 mil", "R$ 10 a 30 mil", "R$ 30 a 100 mil", "Acima de R$ 100 mil"] },
  { id: "ajuda", rotulo: "O que ajudaria você agora?" },
];

function proximosDias() {
  const out: Date[] = [];
  const d = new Date();
  while (out.length < 7) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d));
  }
  return out;
}

export default function ReuniaoForm() {
  const dias = useMemo(() => proximosDias(), []);
  const [resp, setResp] = useState<Record<string, string>>({});
  const [dia, setDia] = useState(0);
  const [hora, setHora] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  // ocupados de mentira, só para a prévia
  const ocupado = (i: number) => (dia * 7 + i * 3) % 5 === 0;

  if (ok) {
    return (
      <div className="card px-5 py-5">
        <p className="text-[15px] font-extrabold">Reunião simulada: {fmt(dias[dia])} às {hora}</p>
        <p className="mt-1 text-[13px] text-ink-soft">Nesta prévia nada foi enviado nem entrou na agenda. Na versão final, o briefing vai junto no convite do Google Agenda.</p>
        <button className="btn btn-secondary btn-md mt-3" onClick={() => { setOk(false); setHora(null); }}>Voltar</button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (hora) setOk(true); }}>
      <section className="card space-y-4 px-5 py-5">
        <p className="text-[14px] font-extrabold">1. Conte um pouco do seu momento</p>
        {PERGUNTAS.map((p) => (
          <div key={p.id}>
            <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">{p.rotulo}</label>
            {p.opcoes ? (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {p.opcoes.map((o) => (
                  <button type="button" key={o} onClick={() => setResp({ ...resp, [p.id]: o })} className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${resp[p.id] === o ? "border-purple bg-purple/10 text-purple" : "border-line text-ink-soft"}`}>{o}</button>
                ))}
              </div>
            ) : (
              <input className="input mt-1 w-full" required value={resp[p.id] ?? ""} onChange={(e) => setResp({ ...resp, [p.id]: e.target.value })} />
            )}
          </div>
        ))}
      </section>
      <section className="card px-5 py-5">
        <p className="mb-3 text-[14px] font-extrabold">2. Escolha o horário (25 minutos)</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {dias.map((d, i) => (
            <button type="button" key={i} onClick={() => { setDia(i); setHora(null); }} className={`rounded-xl border px-3 py-1.5 text-[12.5px] font-bold ${dia === i ? "border-purple bg-purple/10 text-purple" : "border-line text-ink-soft"}`}>{fmt(d)}</button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {HORARIOS.map((h, i) => (
            <button type="button" key={h.inicio} disabled={ocupado(i)} onClick={() => setHora(h.inicio)} className={`rounded-xl border px-2 py-1.5 text-[12.5px] font-bold disabled:opacity-35 disabled:line-through ${hora === h.inicio ? "border-purple bg-purple text-white" : "border-line"}`}>{h.inicio}–{h.fim}</button>
          ))}
        </div>
        <button className="btn btn-primary btn-md mt-4" disabled={!hora}>Confirmar horário</button>
        <p className="mt-2 text-[12px] text-ink-faint">Prévia: os horários ocupados são fictícios e nada é enviado.</p>
      </section>
    </form>
  );
}

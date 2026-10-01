"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Pause, Play, Send, XCircle } from "lucide-react";
import type { StatusCampanha } from "@/lib/campanhas";
import { cancelarCampanha, iniciarCampanha, pausarCampanha, processarAgora } from "../actions";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function CampanhaAcompanhamento({
  id,
  status,
  total,
  enviados,
  falhas,
  ignorados,
  pendentes,
  pausaMotivo,
}: {
  id: string;
  status: StatusCampanha;
  total: number;
  enviados: number;
  falhas: number;
  ignorados: number;
  pendentes: number;
  pausaMotivo: string | null;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [confirmaCancelar, setConfirmaCancelar] = useState(false);
  const [pendente, iniciar] = useTransition();
  const rodando = useRef(false);

  const feitos = enviados + falhas;
  const pct = total > 0 ? Math.min(100, Math.round((feitos / total) * 100)) : 0;

  // Enquanto a campanha está "enviando" e a página aberta, manda lote após lote.
  // O que sobrar (limite diário, pausa de qualidade) sai sozinho na rotina das 10h.
  useEffect(() => {
    if (status !== "enviando" || rodando.current) return;
    rodando.current = true;
    let cancelado = false;
    (async () => {
      while (!cancelado) {
        setProcessando(true);
        const r = await processarAgora();
        setProcessando(false);
        if (r.erro !== null) {
          setErro(r.erro);
          break;
        }
        router.refresh();
        if (r.lotes === 0 || r.enviados + r.falhas === 0) {
          setAviso("Nada mais para enviar agora. O que faltar sai sozinho na próxima rotina diária, respeitando o limite de 250 mensagens por dia e a pausa de qualidade do número.");
          break;
        }
        await espera(1200);
      }
      rodando.current = false;
    })();
    return () => {
      cancelado = true;
      rodando.current = false;
    };
  }, [status, router]);

  function acao(fn: (id: string) => Promise<{ erro: string | null }>) {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await fn(id);
      if (r.erro !== null) setErro(r.erro);
      setConfirmaCancelar(false);
      router.refresh();
    });
  }

  const cartoes = [
    { rotulo: "Público", valor: total, cor: "" },
    { rotulo: "Enviadas", valor: enviados, cor: "text-teal" },
    { rotulo: "Na fila", valor: pendentes, cor: "text-purple" },
    { rotulo: "Falharam", valor: falhas, cor: falhas > 0 ? "text-coral" : "" },
    { rotulo: "Ignorados", valor: ignorados, cor: "" },
  ];
  const ativa = status === "enviando" || status === "agendada";

  return (
    <div className="flex flex-col gap-4">
      {status === "pausada" && pausaMotivo === "muitas_falhas" && (
        <p className="flex items-start gap-2 rounded-2xl border border-coral/25 bg-[#fdece9] px-4 py-3 text-[13px] font-semibold text-[#8f2a1c]">
          <CircleAlert size={17} className="mt-px shrink-0" />
          <span>
            A campanha pausou sozinha porque muitas mensagens falharam. Isso protege a qualidade do seu número. Confira se o modelo foi aprovado pela Meta e se o nome está idêntico, e então retome.
          </span>
        </p>
      )}

      <section className="card px-5 py-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <p className="text-[13px] font-bold text-ink-soft">
            {status === "concluida" ? "Concluída" : status === "cancelada" ? "Cancelada" : status === "agendada" ? "Aguardando o horário agendado" : status === "pausada" ? "Pausada" : processando ? "Enviando agora…" : "Em andamento"}
          </p>
          <p className="text-[22px] font-extrabold tabular-nums">{pct}%</p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#0a7f69] via-[#6d5be0] to-[#8b7fe8] transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {cartoes.map((c) => (
            <div key={c.rotulo} className="rounded-xl bg-bg px-3 py-3 text-center">
              <p className={`text-[22px] font-extrabold tabular-nums ${c.cor}`}>{c.valor}</p>
              <p className="text-[11.5px] font-semibold text-ink-soft">{c.rotulo}</p>
            </div>
          ))}
        </div>

        {status === "enviando" && <p className="mt-4 text-[12.5px] text-ink-soft">Mantenha esta página aberta até terminar. O WhatsApp limita a 250 mensagens por dia por negócio; o que passar disso continua no dia seguinte.</p>}
        {aviso && <p className="mt-3 rounded-xl bg-[#e6eefc] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#1d4c9e]">{aviso}</p>}
        {erro && <p role="alert" className="shake mt-3 rounded-xl border border-coral/25 bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">{erro}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {ativa && (
            <button type="button" disabled={pendente} onClick={() => acao(pausarCampanha)} className="btn btn-secondary btn-md">
              <Pause size={15} /> Pausar
            </button>
          )}
          {status === "pausada" && (
            <button type="button" disabled={pendente} onClick={() => acao(iniciarCampanha)} className={`btn btn-primary btn-md ${pendente ? "btn-loading" : ""}`}>
              <Play size={15} /> Retomar envio
            </button>
          )}
          {status === "enviando" && !processando && (
            <button type="button" onClick={() => { setAviso(null); router.refresh(); }} className="btn btn-ghost btn-md">
              <Send size={15} /> Atualizar
            </button>
          )}
          {["agendada", "enviando", "pausada"].includes(status) &&
            (confirmaCancelar ? (
              <span className="flex items-center gap-2 rounded-xl bg-[#fdece9] px-3 py-1.5">
                <span className="text-[12.5px] font-bold text-[#8f2a1c]">Cancelar o que ainda não foi enviado?</span>
                <button type="button" disabled={pendente} onClick={() => acao(cancelarCampanha)} className="btn btn-danger btn-sm">Sim, cancelar</button>
                <button type="button" onClick={() => setConfirmaCancelar(false)} className="btn btn-ghost btn-sm">Não</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmaCancelar(true)} className="btn btn-ghost btn-md !text-coral">
                <XCircle size={15} /> Cancelar campanha
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}

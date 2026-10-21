"use client";

import { useState, useTransition } from "react";
import { buscarMaquininhas, desconectarMercadoPago, escolherMaquininha } from "./mp-actions";

type Terminal = { id: string; operating_mode?: string };

export default function ConectarMercadoPago({ conectada, terminalId }: { conectada: boolean; terminalId: string | null }) {
  const [pendente, iniciar] = useTransition();
  const [terminais, setTerminais] = useState<Terminal[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [atual, setAtual] = useState<string | null>(terminalId);

  if (!conectada) {
    return (
      // Link comum (não fetch): o Mercado Pago pede login e autorização na página dele e devolve para cá.
      <a href="/api/mercadopago/conectar" className="btn btn-primary btn-md inline-flex">Conectar Mercado Pago</a>
    );
  }

  return (
    <div>
      <p className="text-[13px]"><b className="text-teal">Conectado.</b> As cobranças geradas no Checkout caem na sua conta Mercado Pago e dão baixa sozinhas.</p>

      <div className="mt-3">
        <p className="text-[12.5px] font-bold">Maquininha Point {atual ? <span className="font-normal text-ink-soft">(escolhida: {atual})</span> : <span className="font-normal text-ink-soft">(opcional)</span>}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button type="button" disabled={pendente} className="btn btn-secondary btn-md disabled:opacity-60" onClick={() => iniciar(async () => {
            const r = await buscarMaquininhas();
            setErro(r.erro);
            setTerminais(r.terminais);
          })}>{pendente ? "Buscando…" : "Buscar minhas maquininhas"}</button>
          {terminais.map((t) => (
            <button key={t.id} type="button" disabled={pendente} className="btn btn-secondary btn-md" onClick={() => iniciar(async () => {
              const r = await escolherMaquininha(t.id);
              setErro(r.erro);
              if (!r.erro) { setAtual(t.id); setTerminais([]); }
            })}>
              Usar {t.id}{t.operating_mode && t.operating_mode !== "PDV" ? " (precisa do modo PDV)" : ""}
            </button>
          ))}
        </div>
        {erro && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-coral">{erro}</p>}
        <p className="mt-1 text-[11.5px] text-ink-faint">Para receber cobranças do sistema, a maquininha precisa estar no modo PDV (no app Mercado Pago: Seu negócio &gt; Maquininha &gt; Configurações).</p>
      </div>

      <form action={desconectarMercadoPago} className="mt-3">
        <button type="submit" className="text-[12px] font-bold text-coral">Desconectar</button>
      </form>
    </div>
  );
}

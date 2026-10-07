"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { estornarPagamento } from "./actions";

export default function EstornarBotao({ id }: { id: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="text-[12px] font-semibold text-ink-faint hover:text-coral">
        Estornar
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <span className="text-[12px] text-ink-soft">Devolve os produtos ao estoque. Confirmar?</span>
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await estornarPagamento(id);
            if (r.erro) setErro(r.erro);
            else router.refresh();
          })
        }
        className="rounded-full bg-coral px-3 py-1 text-[12px] font-bold text-white disabled:opacity-60"
      >
        {pendente ? "Estornando…" : "Sim, estornar"}
      </button>
      <button type="button" onClick={() => setConfirmando(false)} className="text-[12px] font-semibold text-ink-soft">Manter</button>
      {erro && <span role="alert" className="w-full text-right text-[12px] font-semibold text-coral">{erro}</span>}
    </span>
  );
}

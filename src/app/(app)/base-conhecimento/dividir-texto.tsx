"use client";

import { useState, useTransition } from "react";
import { Wand2 } from "lucide-react";
import { dividirTextoLongo, type EstadoDivisao } from "./blocos-actions";
import RevisarEntradas from "./revisar-entradas";

/** Aviso para texto corrido: a IA separa em itens curtos, você revisa e só então o original é trocado. */
export default function DividirTexto({ id, tamanho }: { id: string; tamanho: number }) {
  const [res, setRes] = useState<EstadoDivisao | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <section className="card mb-5 border-amber/40 bg-[#fffaf0] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold">Você tem um texto corrido de {tamanho.toLocaleString("pt-BR")} caracteres</p>
          <p className="text-[12.5px] text-ink-soft">
            Textos longos são difíceis de atualizar e o robô acha menos coisas neles. A IA separa em itens curtos e você revisa antes de trocar. O original só é apagado depois que você salvar os novos.
          </p>
        </div>
        <button
          type="button"
          disabled={pendente}
          onClick={() => iniciar(async () => setRes(await dividirTextoLongo(id)))}
          className={`btn btn-primary btn-md ${pendente ? "btn-loading" : ""}`}
        >
          <Wand2 size={15} /> Dividir em blocos com IA
        </button>
      </div>
      {res?.erro && <p className="mt-3 text-[12.5px] font-semibold text-coral">{res.erro}</p>}
      {res?.aviso && <p className="mt-3 text-[12.5px] font-semibold text-amber">{res.aviso}</p>}
      {res && res.entradas.length > 0 && <RevisarEntradas entradas={res.entradas} tipo="texto" arquivoId={null} substituirId={id} />}
    </section>
  );
}

"use client";

import { useActionState, useState } from "react";
import { processarArquivo, type ExtracaoState } from "./actions";
import RevisarEntradas from "./revisar-entradas";

const initialState: ExtracaoState = { entradas: [], erro: null, aviso: null, arquivoId: null };

export default function UploadArquivo() {
  const [state, formAction, pending] = useActionState(
    processarArquivo,
    initialState,
  );
  const [nomeArquivo, setNomeArquivo] = useState("");

  return (
    <div>
      <form action={formAction} className="flex flex-col gap-2.5">
        <label
          htmlFor="arquivo"
          className="cursor-pointer rounded-[12px] border border-dashed border-border bg-surface-soft px-6 py-8 text-center"
        >
          <input
            id="arquivo"
            name="arquivo"
            type="file"
            accept=".pdf,.docx,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,text/plain"
            className="hidden"
            onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? "")}
          />
          <svg
            className="icon mx-auto mb-2"
            style={{ color: "var(--ink-faint)" }}
            viewBox="0 0 24 24"
            width="22"
            height="22"
          >
            <path d="M4 19V6a2 2 0 0 1 2-2h9l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
            <path d="M14 4v5h5" />
          </svg>
          <p className="text-[13px] text-ink-soft">
            {nomeArquivo ||
              "Arraste sua planilha de preços (.csv), catálogo em PDF ou documento Word (.docx), ou clique pra escolher"}
          </p>
        </label>
        <button
          type="submit"
          disabled={pending || !nomeArquivo}
          className="btn self-start bg-ink px-4 py-2 text-[12.5px] text-white disabled:opacity-60"
        >
          {pending ? "Lendo…" : "Processar arquivo"}
        </button>
      </form>

      {state.erro && (
        <div className="mt-3 rounded-[10px] border border-coral/30 bg-coral/5 px-3.5 py-2.5">
          <p className="text-[12.5px] font-semibold text-coral">{state.erro}</p>
        </div>
      )}

      {!state.erro && state.entradas.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-teal/30 bg-teal/5 px-3.5 py-2.5">
          <svg className="icon shrink-0 text-teal" viewBox="0 0 24 24" width="16" height="16">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <p className="text-[12.5px] font-semibold text-teal">
            Arquivo lido com sucesso — revise os itens abaixo antes de salvar.
          </p>
        </div>
      )}

      {state.aviso && (
        <div className="mt-3 rounded-[10px] border border-purple/30 bg-purple/5 px-3.5 py-2.5">
          <p className="text-[12.5px] font-semibold text-purple">{state.aviso}</p>
        </div>
      )}

      <RevisarEntradas
        key={state.entradas.join("|")}
        entradas={state.entradas}
        tipo="arquivo"
        arquivoId={state.arquivoId}
      />
    </div>
  );
}

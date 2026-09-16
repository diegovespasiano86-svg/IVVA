"use client";

import { useActionState, useState } from "react";
import { processarArquivo, type ExtracaoState } from "./actions";
import RevisarEntradas from "./revisar-entradas";

const initialState: ExtracaoState = { entradas: [], erro: null };

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
            accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
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
              "Arraste sua planilha de preços (.csv) ou catálogo em PDF, ou clique pra escolher"}
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
        <p className="mt-2 text-[12px] font-semibold text-coral">{state.erro}</p>
      )}

      <RevisarEntradas
        key={state.entradas.join("|")}
        entradas={state.entradas}
        tipo="arquivo"
      />
    </div>
  );
}

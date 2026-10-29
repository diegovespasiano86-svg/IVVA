"use client";

import { useActionState } from "react";
import { aprovarRascunho, descartarRascunho } from "../actions";

const initialState: { erro: string | null } = { erro: null };

/** Resposta que o robô escreveu e está esperando a sua aprovação (modo "sugerir e aprovar"). */
export default function RascunhoForm({ rascunhoId, texto, fontes }: { rascunhoId: string; texto: string; fontes: string[] }) {
  const [state, formAction, pending] = useActionState(aprovarRascunho, initialState);

  return (
    <div className="mt-3 rounded-[12px] border border-purple/35 bg-purple/5 px-4 py-3.5">
      <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-purple">Resposta sugerida pelo robô, aguardando você</p>
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="rascunho_id" value={rascunhoId} />
        <textarea name="conteudo" defaultValue={texto} rows={4} className="input w-full text-[13px]" />
        {fontes.length > 0 && (
          <details className="text-[11.5px] text-ink-faint">
            <summary className="cursor-pointer select-none font-semibold">Fonte da resposta</summary>
            <ul className="mt-1 flex flex-col gap-1">
              {fontes.map((f, i) => (
                <li key={i} className="rounded-md bg-surface-soft px-2 py-1 text-ink-soft">{f}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className={`btn btn-primary btn-md ${pending ? "btn-loading" : ""}`}>
            Aprovar e enviar
          </button>
          <button type="submit" formAction={descartarRascunho} formNoValidate className="btn btn-ghost btn-md">
            Descartar
          </button>
        </div>
        {state?.erro && <p className="text-[12px] font-semibold text-coral">{state.erro}</p>}
      </form>
    </div>
  );
}

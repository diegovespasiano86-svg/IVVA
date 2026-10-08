"use client";

import { useActionState } from "react";
import { lerMeuSite, type LerSiteState } from "./ler-site-actions";
import RevisarEntradas from "./revisar-entradas";

const inicial: LerSiteState = { entradas: [], erro: null, aviso: null, arquivoId: null };

export default function LerSite() {
  const [state, formAction, pending] = useActionState(lerMeuSite, inicial);

  return (
    <div>
      <form action={formAction} className="flex flex-col gap-2.5">
        <label htmlFor="endereco-site" className="text-[12.5px] font-semibold text-ink-soft">
          Endereço do seu site (ou de uma página dele)
        </label>
        <input
          id="endereco-site"
          name="endereco"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="meusite.com.br/servicos"
          className="rounded-[10px] border border-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none focus:border-purple"
        />
        <button type="submit" disabled={pending} className="btn self-start bg-ink px-4 py-2 text-[12.5px] text-white disabled:opacity-60">
          {pending ? "Lendo o site…" : "Ler meu site"}
        </button>
        <p className="text-[11.5px] text-ink-faint">
          A ivva lê só o texto público da página e sugere itens para a base. Nada é salvo até você revisar e confirmar.
        </p>
      </form>

      {state.erro && (
        <div className="mt-3 rounded-[10px] border border-coral/30 bg-coral/5 px-3.5 py-2.5">
          <p className="text-[12.5px] font-semibold text-coral">{state.erro}</p>
        </div>
      )}
      {state.aviso && (
        <div className="mt-3 rounded-[10px] border border-purple/30 bg-purple/5 px-3.5 py-2.5">
          <p className="text-[12.5px] font-semibold text-purple">{state.aviso}</p>
        </div>
      )}

      <RevisarEntradas key={state.entradas.join("|")} entradas={state.entradas} tipo="texto" arquivoId={null} />
    </div>
  );
}

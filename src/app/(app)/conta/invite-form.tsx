"use client";

import { useActionState, useState } from "react";
import { criarConvite } from "./actions";

const initialState: { erro: string | null; link: string | null } = {
  erro: null,
  link: null,
};

export default function InviteForm() {
  const [state, formAction, pending] = useActionState(
    criarConvite,
    initialState,
  );
  const [copiado, setCopiado] = useState(false);

  async function copiarLink() {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível (ex: contexto não seguro) — o link já
      // fica visível na tela pra copiar manualmente.
    }
  }

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="invite-nome" className="!mb-1">
            Nome
          </label>
          <input
            id="invite-nome"
            name="nome"
            required
            placeholder="Nome do profissional"
            className="w-[160px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
          />
        </div>
        <div>
          <label htmlFor="invite-email" className="!mb-1">
            E-mail
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="pessoa@email.com"
            className="w-[190px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn bg-ink px-4 py-2 text-[12.5px] text-white disabled:opacity-60"
        >
          {pending ? "Gerando…" : "+ Convidar"}
        </button>
      </form>

      {state.erro && (
        <p className="mt-2 text-[12px] font-semibold text-coral">{state.erro}</p>
      )}

      {state.link && (
        <div className="mt-3 rounded-[10px] border border-teal/30 bg-teal/5 px-3.5 py-3">
          <p className="mb-1.5 text-[12px] font-bold text-teal">
            Convite criado — envie esse link pra pessoa pelo WhatsApp
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-surface px-2.5 py-1.5 text-[12px]">
              {state.link}
            </code>
            <button
              type="button"
              onClick={copiarLink}
              className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:bg-surface-soft"
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

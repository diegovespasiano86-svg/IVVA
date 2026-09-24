"use client";

import { useActionState, useState } from "react";
import { excluirConta } from "./actions";

export default function ApagarConta({ tenantNome }: { tenantNome: string }) {
  const [revelado, setRevelado] = useState(false);
  const [state, formAction, pending] = useActionState(excluirConta, {
    erro: null,
  });

  return (
    <div className="card border-coral/30 px-5 py-5">
      <p className="mb-1 text-[12.5px] font-bold uppercase tracking-wide text-coral">
        Zona de risco
      </p>
      <p className="mb-3 text-[12.5px] text-ink-soft">
        Apaga permanentemente a conta de <strong>{tenantNome}</strong>: todos
        os contatos, conversas, mensagens, agenda, base de conhecimento,
        equipe e a conexão com o WhatsApp. Sua assinatura também é
        cancelada. Não pode ser desfeito.
      </p>

      {!revelado ? (
        <button
          type="button"
          onClick={() => setRevelado(true)}
          className="rounded-[10px] border border-coral/40 px-3.5 py-2 text-[12.5px] font-semibold text-coral hover:bg-coral/5"
        >
          Apagar conta
        </button>
      ) : (
        <form
          action={formAction}
          className="rounded-[12px] border border-coral/30 bg-coral/5 px-4 py-4"
        >
          <div className="mb-3">
            <label htmlFor="nome_confirmacao" className="!text-coral">
              Digite o nome do negócio ({tenantNome}) pra confirmar
            </label>
            <input
              id="nome_confirmacao"
              name="nome_confirmacao"
              autoComplete="off"
              className="w-full rounded-[10px] border border-coral/40 bg-surface px-3 py-2 text-[13px]"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="senha_exclusao" className="!text-coral">
              Confirme sua senha
            </label>
            <input
              id="senha_exclusao"
              name="senha"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-[10px] border border-coral/40 bg-surface px-3 py-2 text-[13px]"
            />
          </div>

          {state?.erro && (
            <p role="alert" className="mb-3 text-[12.5px] font-semibold text-coral">
              {state.erro}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRevelado(false)}
              className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn bg-coral px-3.5 py-2 text-[12.5px] text-white disabled:opacity-60"
            >
              {pending ? "Apagando…" : "Apagar tudo definitivamente"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

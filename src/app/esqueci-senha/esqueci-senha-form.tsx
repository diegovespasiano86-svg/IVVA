"use client";

import { useActionState } from "react";
import { solicitarRecuperacaoSenha, type EsqueciSenhaState } from "./actions";

const initialState: EsqueciSenhaState = { erro: null, enviado: false };

export default function EsqueciSenhaForm() {
  const [state, formAction, pending] = useActionState(solicitarRecuperacaoSenha, initialState);

  if (state.enviado) {
    return (
      <div className="mt-6 flex items-center gap-2.5 rounded-[10px] border border-teal/30 bg-teal/5 px-3.5 py-3">
        <svg className="icon shrink-0 text-teal" viewBox="0 0 24 24" width="18" height="18">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <p className="text-[13px] font-semibold text-teal">
          Se esse e-mail tiver uma conta na ivva, mandamos um link pra você criar uma senha nova. Confere sua caixa de entrada (e o spam).
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="voce@seunegocio.com.br"
          className="w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-purple"
        />
      </div>

      {state.erro && (
        <p role="alert" className="text-[13px] font-semibold text-coral">
          {state.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn mt-1 w-full justify-center bg-ink py-3 text-[14px] text-white disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Mandar link de recuperação"}
      </button>
    </form>
  );
}

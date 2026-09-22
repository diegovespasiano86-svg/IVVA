"use client";

import { useActionState } from "react";
import { redefinirSenha } from "./actions";

export default function RedefinirSenhaForm() {
  const [error, formAction, pending] = useActionState(redefinirSenha, undefined);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="senha">Senha nova</label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="••••••••"
          className="w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-purple"
        />
      </div>

      <div>
        <label htmlFor="confirmacao">Confirme a senha nova</label>
        <input
          id="confirmacao"
          name="confirmacao"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="••••••••"
          className="w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-purple"
        />
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-coral">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn mt-1 w-full justify-center bg-ink py-3 text-[14px] text-white disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar senha nova"}
      </button>
    </form>
  );
}

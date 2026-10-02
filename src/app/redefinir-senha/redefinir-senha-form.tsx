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
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          className="input !h-[46px]"
        />
      </div>

      <div>
        <label htmlFor="confirmacao">Confirme a senha nova</label>
        <input
          id="confirmacao"
          name="confirmacao"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          className="input !h-[46px]"
        />
      </div>

      {error && (
        <p role="alert" className="shake rounded-xl border border-coral/25 bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`btn btn-primary btn-lg mt-1 w-full ${pending ? "btn-loading" : ""}`}
      >
        {pending ? "Salvando…" : "Salvar senha nova"}
      </button>
    </form>
  );
}

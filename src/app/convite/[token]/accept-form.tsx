"use client";

import { useActionState } from "react";
import { aceitarConvite } from "./actions";

export default function AcceptForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(
    aceitarConvite,
    undefined,
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="senha">Crie uma senha</label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          minLength={6}
          placeholder="Pelo menos 6 caracteres"
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
        {pending ? "Entrando…" : "Aceitar convite e entrar"}
      </button>
    </form>
  );
}

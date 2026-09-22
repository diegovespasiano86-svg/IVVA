"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [error, formAction, pending] = useActionState(login, undefined);

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

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="!mb-0">Senha</label>
          <Link href="/esqueci-senha" className="text-[12.5px] font-semibold text-purple">
            Esqueceu?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="mt-1 w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] outline-none focus:border-purple"
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
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

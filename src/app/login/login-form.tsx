"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { login } from "./actions";

export default function LoginForm() {
  const [error, formAction, pending] = useActionState(login, undefined);
  const [ver, setVer] = useState(false);

  return (
    <form action={formAction} className="mt-7 flex flex-col gap-4">
      <div>
        <label htmlFor="email">E-mail</label>
        <div className="relative">
          <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="voce@seunegocio.com.br" className="input !h-[46px] !pl-10" />
        </div>
      </div>

      <div>
        <div className="mb-[7px] flex items-center justify-between">
          <label htmlFor="password" className="!mb-0">
            Senha
          </label>
          <Link href="/esqueci-senha" className="text-[12.5px] font-bold text-purple hover:underline">
            Esqueceu?
          </Link>
        </div>
        <div className="relative">
          <Lock size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            id="password"
            name="password"
            type={ver ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="input !h-[46px] !pl-10 !pr-11"
          />
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? "Esconder a senha" : "Mostrar a senha"}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint hover:bg-surface-soft hover:text-ink"
          >
            {ver ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>

      {error && (
        <p key={error} role="alert" className="shake rounded-xl border border-coral/25 bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`btn btn-primary btn-lg mt-1 w-full ${pending ? "btn-loading" : ""}`}>
        Entrar <ArrowRight size={17} className="btn-arrow" />
      </button>
    </form>
  );
}

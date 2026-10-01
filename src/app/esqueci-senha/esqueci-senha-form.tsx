"use client";

import { useActionState } from "react";
import { ArrowRight, CircleCheck, Mail } from "lucide-react";
import { solicitarRecuperacaoSenha, type EsqueciSenhaState } from "./actions";

const initialState: EsqueciSenhaState = { erro: null, enviado: false };

export default function EsqueciSenhaForm() {
  const [state, formAction, pending] = useActionState(solicitarRecuperacaoSenha, initialState);

  if (state.enviado) {
    return (
      <div className="mt-7 flex items-start gap-2.5 rounded-xl border border-teal/25 bg-[#e3f4ef] px-4 py-3.5">
        <CircleCheck size={19} className="mt-px shrink-0 text-teal" />
        <p className="text-[13px] font-semibold leading-snug text-teal">
          Se esse e-mail tiver uma conta na ivva, mandamos um link pra você criar uma senha nova. Confere sua caixa de entrada (e o spam).
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-7 flex flex-col gap-4">
      <div>
        <label htmlFor="email">E-mail</label>
        <div className="relative">
          <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="voce@seunegocio.com.br" className="input !h-[46px] !pl-10" />
        </div>
      </div>

      {state.erro && (
        <p key={state.erro} role="alert" className="shake rounded-xl border border-coral/25 bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">
          {state.erro}
        </p>
      )}

      <button type="submit" disabled={pending} className={`btn btn-primary btn-lg mt-1 w-full ${pending ? "btn-loading" : ""}`}>
        Mandar link de recuperação <ArrowRight size={17} className="btn-arrow" />
      </button>
    </form>
  );
}

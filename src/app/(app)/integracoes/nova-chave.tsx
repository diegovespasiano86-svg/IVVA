"use client";

import { useActionState } from "react";
import { criarChave, type ChaveState } from "./actions";

export default function NovaChave() {
  const [state, action, pending] = useActionState<ChaveState, FormData>(criarChave, { chave: null, erro: null });
  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input name="nome" placeholder="Nome da chave (ex.: Zapier)" maxLength={60} className="input !w-[260px]" />
        <button type="submit" disabled={pending} className="btn btn-primary btn-md">{pending ? "Criando…" : "Criar chave"}</button>
      </form>
      {state.erro && <p role="alert" className="mt-2 text-[13px] font-semibold text-coral">{state.erro}</p>}
      {state.chave && (
        <div className="mt-3 rounded-xl border border-teal/40 bg-[#e3f4ef] px-4 py-3">
          <p className="text-[12.5px] font-bold">Copie agora: esta chave não aparece de novo.</p>
          <code className="mt-1 block break-all text-[12.5px]">{state.chave}</code>
        </div>
      )}
    </div>
  );
}

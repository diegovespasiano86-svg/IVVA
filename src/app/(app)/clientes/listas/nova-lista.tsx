"use client";

import { useActionState, useRef } from "react";
import { criarLista } from "../segmentacao-actions";

export default function NovaLista() {
  const ref = useRef<HTMLFormElement>(null);
  const [estado, acao, pendente] = useActionState(async (anterior: { erro: string | null } | undefined, fd: FormData) => {
    const r = await criarLista(anterior, fd);
    if (!r.erro) ref.current?.reset();
    return r;
  }, undefined);

  return (
    <form ref={ref} action={acao} className="flex flex-col gap-3">
      <div>
        <label htmlFor="nome-lista">Nome</label>
        <input id="nome-lista" name="nome" required maxLength={80} placeholder="Ex.: Aniversariantes de outubro" className="input" />
      </div>
      <div>
        <label htmlFor="desc-lista">Descrição (opcional)</label>
        <input id="desc-lista" name="descricao" maxLength={500} placeholder="Para que serve esta lista?" className="input" />
      </div>
      {estado?.erro && <p className="rounded-xl bg-[#fdece9] px-3 py-2 text-[12.5px] font-semibold text-[#8f2a1c]">{estado.erro}</p>}
      <button type="submit" disabled={pendente} className={`btn btn-primary btn-md self-start ${pendente ? "btn-loading" : ""}`}>
        Criar lista
      </button>
    </form>
  );
}

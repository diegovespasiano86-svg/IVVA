"use client";

import { useActionState, useRef, useState } from "react";
import { CORES_ETIQUETA, ESTILO_ETIQUETA } from "@/lib/clientes";
import { criarEtiqueta } from "../segmentacao-actions";

export default function NovaEtiqueta() {
  const [cor, setCor] = useState<string>("roxo");
  const ref = useRef<HTMLFormElement>(null);
  const [estado, acao, pendente] = useActionState(async (anterior: { erro: string | null } | undefined, fd: FormData) => {
    const r = await criarEtiqueta(anterior, fd);
    if (!r.erro) ref.current?.reset();
    return r;
  }, undefined);

  return (
    <form ref={ref} action={acao} className="flex flex-col gap-3">
      <div>
        <label htmlFor="nome-etiqueta">Nome</label>
        <input id="nome-etiqueta" name="nome" required maxLength={40} placeholder="Ex.: VIP" className="input" />
      </div>
      <div>
        <span className="mb-[7px] block text-[12.5px] font-bold text-ink-soft">Cor</span>
        <input type="hidden" name="cor" value={cor} />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor da etiqueta">
          {CORES_ETIQUETA.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={cor === c}
              aria-label={c}
              onClick={() => setCor(c)}
              className={`h-8 rounded-full px-3 text-[12px] font-bold capitalize transition-all ${ESTILO_ETIQUETA[c]} ${cor === c ? "ring-2 ring-purple ring-offset-2" : "opacity-80 hover:opacity-100"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {estado?.erro && <p className="rounded-xl bg-[#fdece9] px-3 py-2 text-[12.5px] font-semibold text-[#8f2a1c]">{estado.erro}</p>}
      <button type="submit" disabled={pendente} className={`btn btn-primary btn-md self-start ${pendente ? "btn-loading" : ""}`}>
        Criar etiqueta
      </button>
    </form>
  );
}

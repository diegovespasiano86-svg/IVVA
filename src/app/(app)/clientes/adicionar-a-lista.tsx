"use client";

import { useActionState } from "react";
import { ListPlus } from "lucide-react";
import { adicionarFiltradosALista } from "./segmentacao-actions";

/** Pega todos os clientes do filtro atual da tela e coloca numa lista de uma vez. */
export default function AdicionarALista({ listas, ids }: { listas: { id: string; nome: string }[]; ids: string[] }) {
  const [estado, acao, pendente] = useActionState(adicionarFiltradosALista, undefined);
  if (listas.length === 0 || ids.length === 0) return null;

  return (
    <form action={acao} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="ids" value={ids.slice(0, 1000).join(",")} />
      <select name="list_id" required aria-label="Lista de destino" className="select !h-9 !w-auto min-w-[180px]" defaultValue="">
        <option value="" disabled>
          Adicionar estes {Math.min(ids.length, 1000)} à lista…
        </option>
        {listas.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pendente} className={`btn btn-secondary btn-sm ${pendente ? "btn-loading" : ""}`}>
        <ListPlus size={14} /> Adicionar
      </button>
      {estado?.erro && <span className="text-[12.5px] font-semibold text-coral">{estado.erro}</span>}
      {estado && !estado.erro && <span className="text-[12.5px] font-semibold text-teal">{estado.adicionados} adicionados</span>}
    </form>
  );
}

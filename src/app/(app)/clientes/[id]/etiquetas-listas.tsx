"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { ESTILO_ETIQUETA, type CorEtiqueta } from "@/lib/clientes";
import { alternarEtiqueta, alternarLista } from "../segmentacao-actions";

type Opcao = { id: string; nome: string; cor?: string };

export default function EtiquetasListas({
  contactId,
  etiquetas,
  listas,
  etiquetasAtivas,
  listasAtivas,
}: {
  contactId: string;
  etiquetas: Opcao[];
  listas: Opcao[];
  etiquetasAtivas: string[];
  listasAtivas: string[];
}) {
  const [etq, setEtq] = useState(new Set(etiquetasAtivas));
  const [lst, setLst] = useState(new Set(listasAtivas));
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  function trocar(tipo: "etq" | "lst", id: string) {
    const estado = tipo === "etq" ? etq : lst;
    const set = tipo === "etq" ? setEtq : setLst;
    const ativar = !estado.has(id);
    const novo = new Set(estado);
    if (ativar) novo.add(id);
    else novo.delete(id);
    set(novo); // otimista
    setErro(null);
    iniciar(async () => {
      const r = tipo === "etq" ? await alternarEtiqueta(contactId, id, ativar) : await alternarLista(contactId, id, ativar);
      if (r.erro) {
        set(estado); // desfaz
        setErro(r.erro);
      }
    });
  }

  return (
    <section className="card px-5 py-5">
      <h2 className="mb-3 text-[14px] font-extrabold">Etiquetas e listas</h2>

      <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Etiquetas</p>
      {etiquetas.length === 0 ? (
        <p className="mb-4 text-[12.5px] text-ink-soft">
          Nenhuma etiqueta criada. <Link href="/clientes/etiquetas" className="font-bold text-purple hover:underline">Criar etiquetas</Link>
        </p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {etiquetas.map((e) => {
            const ativa = etq.has(e.id);
            const estilo = ESTILO_ETIQUETA[(e.cor as CorEtiqueta) in ESTILO_ETIQUETA ? (e.cor as CorEtiqueta) : "cinza"];
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={ativa}
                onClick={() => trocar("etq", e.id)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold transition-all ${ativa ? estilo : "bg-surface text-ink-faint ring-1 ring-border hover:text-ink"}`}
              >
                {ativa && <Check size={12} strokeWidth={3} />}
                {e.nome}
              </button>
            );
          })}
        </div>
      )}

      <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Listas</p>
      {listas.length === 0 ? (
        <p className="text-[12.5px] text-ink-soft">
          Nenhuma lista criada. <Link href="/clientes/listas" className="font-bold text-purple hover:underline">Criar listas</Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {listas.map((l) => (
            <li key={l.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold hover:bg-surface-soft">
                <input type="checkbox" checked={lst.has(l.id)} onChange={() => trocar("lst", l.id)} />
                {l.nome}
              </label>
            </li>
          ))}
        </ul>
      )}
      {erro && <p className="mt-3 rounded-xl bg-[#fdece9] px-3 py-2 text-[12.5px] font-semibold text-[#8f2a1c]">{erro}</p>}
    </section>
  );
}

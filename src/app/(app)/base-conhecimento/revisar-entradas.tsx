"use client";

import { useState } from "react";
import { salvarEntradas } from "./actions";

type Item = { id: number; texto: string; incluir: boolean };

export default function RevisarEntradas({
  entradas,
  tipo,
  arquivoId,
}: {
  entradas: string[];
  tipo: string;
  arquivoId: string | null;
}) {
  const [itens, setItens] = useState<Item[]>(
    entradas.map((texto, id) => ({ id, texto, incluir: true })),
  );
  const [salvando, setSalvando] = useState(false);

  if (itens.length === 0) return null;

  const selecionados = itens.filter((i) => i.incluir).length;

  async function handleSalvar() {
    setSalvando(true);
    const fd = new FormData();
    fd.set("tipo", tipo);
    if (arquivoId) fd.set("arquivo_id", arquivoId);
    for (const item of itens) {
      if (item.incluir && item.texto.trim()) fd.append("entrada", item.texto.trim());
    }
    await salvarEntradas(fd);
    setItens([]);
    setSalvando(false);
  }

  return (
    <div className="mt-4 rounded-[12px] border border-purple/25 bg-purple/5 px-4 py-4">
      <p className="mb-3 text-[13px] font-bold text-purple">
        {itens.length} {itens.length === 1 ? "item encontrado" : "itens encontrados"} — revise antes de salvar
      </p>
      <div className="flex flex-col gap-2">
        {itens.map((item) => (
          <label key={item.id} className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={item.incluir}
              onChange={(e) =>
                setItens((prev) =>
                  prev.map((p) =>
                    p.id === item.id ? { ...p, incluir: e.target.checked } : p,
                  ),
                )
              }
              className="mt-2 accent-[var(--purple)]"
            />
            <textarea
              value={item.texto}
              onChange={(e) =>
                setItens((prev) =>
                  prev.map((p) =>
                    p.id === item.id ? { ...p, texto: e.target.value } : p,
                  ),
                )
              }
              rows={2}
              className="flex-1 resize-none rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-[12.5px]"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSalvar}
        disabled={salvando || selecionados === 0}
        className="btn mt-3 bg-ink px-4 py-2 text-[12.5px] text-white disabled:opacity-60"
      >
        {salvando
          ? "Salvando…"
          : `Salvar ${selecionados} ${selecionados === 1 ? "item" : "itens"}`}
      </button>
    </div>
  );
}

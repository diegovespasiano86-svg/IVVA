"use client";

import { useState } from "react";
import { editarEntrada, removerEntrada } from "./actions";

export default function EntradaItem({
  id,
  conteudo,
}: {
  id: string;
  conteudo: string;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <form
        action={async (formData) => {
          await editarEntrada(formData);
          setEditando(false);
        }}
        className="card flex flex-col gap-2.5 px-4 py-3.5"
      >
        <input type="hidden" name="id" value={id} />
        <textarea
          name="conteudo"
          defaultValue={conteudo}
          required
          rows={Math.min(10, Math.max(2, Math.ceil(conteudo.length / 80)))}
          autoFocus
          className="resize-y rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="rounded-full border border-border px-3.5 py-1.5 text-[12px] font-semibold text-ink-soft hover:bg-surface-soft"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white"
          >
            Salvar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="card flex items-start justify-between gap-3 px-4 py-3.5">
      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{conteudo}</p>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-soft hover:text-ink"
          title="Editar"
        >
          <svg className="icon" viewBox="0 0 24 24" width="15" height="15">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <form action={removerEntrada}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-soft hover:text-coral"
            title="Remover"
          >
            <svg className="icon" viewBox="0 0 24 24" width="15" height="15">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

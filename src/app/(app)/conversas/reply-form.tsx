"use client";

import { useActionState } from "react";
import { responderConversa } from "./actions";

const initialState: { erro: string | null } = { erro: null };

export default function ReplyForm({
  conversationId,
  telefone,
}: {
  conversationId: string;
  telefone: string;
}) {
  const [state, formAction, pending] = useActionState(
    responderConversa,
    initialState,
  );

  return (
    <form action={formAction} className="mt-2.5 flex flex-col gap-1.5">
      <input type="hidden" name="conversation_id" value={conversationId} />
      <input type="hidden" name="telefone" value={telefone} />
      <div className="flex gap-2">
        <input
          name="conteudo"
          placeholder="Responder como atendente…"
          className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn bg-ink px-4 py-2 text-[12.5px] text-white disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
      {state?.erro && (
        <p className="text-[12px] font-semibold text-coral">{state.erro}</p>
      )}
    </form>
  );
}

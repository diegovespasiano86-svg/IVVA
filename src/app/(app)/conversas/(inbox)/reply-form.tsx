"use client";

import { useActionState } from "react";
import { responderConversa } from "../actions";

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
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={pending}
          className={`btn btn-primary btn-md ${pending ? "btn-loading" : ""}`}
        >
          Enviar
        </button>
      </div>
      {state?.erro && (
        <p className="text-[12px] font-semibold text-coral">{state.erro}</p>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { assinarPlano } from "./actions";

export default function PlanoForm({
  plano,
  destaque,
}: {
  plano: string;
  destaque?: boolean;
}) {
  const [error, formAction, pending] = useActionState(assinarPlano, undefined);

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-2">
      <input type="hidden" name="plano" value={plano} />
      <input
        name="nome_negocio"
        required
        placeholder="Nome do seu negócio"
        className="rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[13px]"
      />
      <button
        type="submit"
        disabled={pending}
        className={`btn justify-center py-3 text-[13.5px] disabled:opacity-60 ${
          destaque ? "bg-purple text-white" : "bg-ink text-white"
        }`}
      >
        {pending ? "Abrindo pagamento…" : "Assinar"}
      </button>
      {error && (
        <p className="text-[12px] font-semibold text-coral">{error}</p>
      )}
    </form>
  );
}

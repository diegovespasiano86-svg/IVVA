"use client";

import { useActionState } from "react";
import { comprarCreditos } from "@/app/(app)/creditos-actions";
import { PACOTE_AVULSO } from "@/lib/planos";

const VALOR = (PACOTE_AVULSO.valorCentavos / 100).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Botão de um clique: abre o pagamento do pacote avulso já pronto. */
export default function ComprarCreditosButton({
  variant = "secondary",
  label,
}: {
  variant?: "primary" | "secondary";
  label?: string;
}) {
  const [erro, formAction, pending] = useActionState(comprarCreditos, undefined);
  return (
    <form action={formAction} className="shrink-0">
      <button
        type="submit"
        disabled={pending}
        className={`btn btn-sm ${variant === "primary" ? "btn-primary" : "btn-secondary"} disabled:opacity-60`}
      >
        {pending ? "Abrindo pagamento…" : (label ?? `Comprar +${PACOTE_AVULSO.conversas} conversas · ${VALOR}`)}
      </button>
      {erro && <p className="mt-1 text-[12px] font-semibold text-coral">{erro}</p>}
    </form>
  );
}

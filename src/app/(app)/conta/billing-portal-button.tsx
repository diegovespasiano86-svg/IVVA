"use client";

import { useActionState } from "react";
import { abrirPortalCobranca } from "./actions";

export default function BillingPortalButton({
  label = "Gerenciar assinatura",
}: {
  label?: string;
}) {
  const [erro, formAction, pending] = useActionState(
    abrirPortalCobranca,
    undefined,
  );

  return (
    <div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="btn w-full justify-center bg-ink px-4 py-2.5 text-[12.5px] text-white disabled:opacity-60"
        >
          {pending ? "Abrindo…" : label}
        </button>
      </form>
      {erro && (
        <p className="mt-2 text-[12px] font-semibold text-coral">{erro}</p>
      )}
    </div>
  );
}

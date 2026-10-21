"use client";

import { useActionState } from "react";
import { conectarAsaas, desconectarAsaas, type AsaasState } from "./asaas-actions";

export default function ConectarAsaas({ conectada, ambiente }: { conectada: boolean; ambiente: string | null }) {
  const [state, action, pending] = useActionState<AsaasState, FormData>(conectarAsaas, { ok: false, erro: null, aviso: null });

  if (conectada) {
    return (
      <div>
        <p className="text-[13px]">
          <b className="text-teal">Conectado</b> {ambiente === "sandbox" ? "(ambiente de teste)" : ""}. As cobranças geradas no Checkout e pelo robô caem na sua conta Asaas e dão baixa sozinhas.
        </p>
        {state.aviso && <p className="mt-2 text-[12.5px] font-semibold text-coral">{state.aviso}</p>}
        <form action={desconectarAsaas} className="mt-3">
          <button type="submit" className="text-[12px] font-bold text-coral">Desconectar</button>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="asaas-chave" className="!mb-1">Chave de API do Asaas</label>
        <input id="asaas-chave" name="chave" type="password" autoComplete="off" required placeholder="$aact_..." className="input" />
        <p className="mt-1 text-[11.5px] text-ink-faint">No Asaas: Integrações &gt; Chaves de API &gt; Gerar. Ela fica guardada criptografada e nunca é mostrada de novo.</p>
      </div>
      <fieldset className="flex gap-4 text-[13px]">
        <label className="flex items-center gap-1.5"><input type="radio" name="ambiente" value="producao" defaultChecked /> Conta real</label>
        <label className="flex items-center gap-1.5"><input type="radio" name="ambiente" value="sandbox" /> Conta de testes (Sandbox)</label>
      </fieldset>
      {state.erro && <p role="alert" className="text-[13px] font-semibold text-coral">{state.erro}</p>}
      <div><button type="submit" disabled={pending} className="btn btn-primary btn-md">{pending ? "Conectando…" : "Conectar Asaas"}</button></div>
    </form>
  );
}

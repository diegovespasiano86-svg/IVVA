"use client";

import { useActionState, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { aceitarContrato, logout } from "./actions";

/** Popup obrigatório: sem o aceite da versão atual do contrato, o sistema não abre. */
export default function ContratoAceite({ email, atualizado, children }: { email: string; atualizado: string; children: React.ReactNode }) {
  const [state, action, pendente] = useActionState(aceitarContrato, { erro: null as string | null });
  const [concordo, setConcordo] = useState(false);

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0b10]/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contrato-titulo"
        className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]"
      >
        <header className="border-b border-line px-6 py-5">
          <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-purple">
            <FileCheck2 size={15} /> Antes de começar
          </p>
          <h1 id="contrato-titulo" className="mt-1.5 font-display text-[21px] font-bold text-ink">
            Contrato de prestação de serviços e termos de uso
          </h1>
          <p className="mt-1 text-[12.5px] text-ink-faint">
            Versão de {atualizado}. Leia e aceite para acessar o sistema. O texto completo fica sempre em{" "}
            <a href="/contrato" target="_blank" rel="noreferrer" className="font-semibold text-purple underline underline-offset-2">
              app.ivva.app.br/contrato
            </a>
            .
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        <form action={action} className="border-t border-line bg-[#faf9fd] px-6 py-4">
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink">
            <input
              type="checkbox"
              name="concordo"
              checked={concordo}
              onChange={(e) => setConcordo(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#6d5be0]"
            />
            <span>
              Li e aceito o contrato, incluindo as regras de uso, a política de cancelamento e reembolso e o tratamento de
              dados (LGPD). Conectado como <b>{email}</b>.
            </span>
          </label>
          {state.erro && <p className="mt-2 text-[12.5px] font-semibold text-coral">{state.erro}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button type="submit" formAction={logout} className="btn btn-ghost btn-md">
              Não concordo, sair
            </button>
            <button type="submit" disabled={!concordo || pendente} className="btn btn-primary btn-md">
              {pendente ? "Registrando..." : "Aceitar e entrar"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { reenviarConfirmacao } from "./actions";

export default function ConfirmarEmail({ email, sessionId }: { email: string; sessionId: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="rounded-2xl border border-teal/30 bg-teal/5 px-5 py-5 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal/15 text-teal">
          <MailCheck size={24} />
        </span>
        <h2 className="text-[17px] font-extrabold">Falta confirmar o seu e-mail</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
          Enviamos um e-mail para <strong className="text-ink">{email}</strong>. Abra e clique em{" "}
          <strong className="text-ink">Confirmar meu e-mail</strong> para ativar o seu acesso. Sem esse clique, o sistema não libera o seu negócio.
        </p>
        <p className="mt-2 text-[12px] text-ink-faint">Pode levar 1 ou 2 minutos. Confira também a caixa de spam.</p>
      </div>

      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await reenviarConfirmacao(sessionId, email);
            setMsg({ ok: r.ok, texto: r.mensagem });
          })
        }
        className="btn btn-secondary btn-md w-full justify-center disabled:opacity-60"
      >
        {pendente ? "Reenviando…" : "Não chegou? Reenviar o e-mail"}
      </button>
      {msg && (
        <p role="status" className={`text-center text-[12.5px] font-semibold ${msg.ok ? "text-teal" : "text-coral"}`}>
          {msg.texto}
        </p>
      )}
    </div>
  );
}

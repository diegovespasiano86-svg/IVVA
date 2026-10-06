"use client";

import { useState } from "react";
import { useActionState } from "react";
import { finalizarCadastro } from "./actions";
import ConfirmarEmail from "./confirmar-email";
import { SEGMENTOS } from "@/lib/segmentos";
import { SegmentoIcon } from "@/lib/segmento-icons";

export default function SetupForm({
  sessionId,
  nomeInicial = "",
  segmentoInicial = null,
}: {
  sessionId: string;
  nomeInicial?: string;
  segmentoInicial?: string | null;
}) {
  const [estado, formAction, pending] = useActionState(finalizarCadastro, undefined);
  const error = estado?.erro ?? null;
  const [segmento, setSegmento] = useState<string | null>(segmentoInicial);

  if (estado?.confirmar) return <ConfirmarEmail email={estado.confirmar} sessionId={sessionId} />;

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="segmento" value={segmento ?? ""} />

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="nome">Seu nome</label>
          <input
            id="nome"
            name="nome"
            required
            defaultValue={nomeInicial}
            placeholder="Como podemos te chamar"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="senha">Crie uma senha</label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            minLength={8}
            placeholder="Pelo menos 8 caracteres"
            className="input"
          />
        </div>
      </div>

      <div>
        <p className="mb-1 text-[13.5px] font-bold text-ink">
          Qual desses é o seu negócio?
        </p>
        <p className="mb-3 text-[12px] text-ink-faint">
          A gente já deixa a base de conhecimento do robô pré-configurada
          pro seu nicho — você só ajusta valores e horários depois.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SEGMENTOS.map((s) => {
            const ativo = segmento === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSegmento(s.id)}
                aria-pressed={ativo}
                className={`flex flex-col items-start gap-2 rounded-[12px] border px-3 py-3 text-left transition-colors ${
                  ativo
                    ? "border-purple bg-purple/10"
                    : "border-border bg-surface hover:border-purple/50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-[9px] ${
                    ativo ? "bg-purple text-white" : "bg-surface-soft text-ink-soft"
                  }`}
                >
                  <SegmentoIcon id={s.id} className="icon !h-4 !w-4" />
                </span>
                <span>
                  <span className="block text-[12.5px] font-bold leading-tight text-ink">
                    {s.nome}
                  </span>
                  <span className="block text-[11px] leading-tight text-ink-faint">
                    {s.descricao}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-coral">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !segmento}
        className="btn mt-1 w-full justify-center bg-ink py-3 text-[14px] text-white disabled:opacity-60"
      >
        {pending
          ? "Criando o seu acesso…"
          : !segmento
            ? "Escolha seu tipo de negócio"
            : "Começar a usar a ivva"}
      </button>
    </form>
  );
}

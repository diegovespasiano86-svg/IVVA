"use client";

import { useActionState } from "react";
import { atualizarIdentidadeAssistente } from "./actions";

type Identidade = {
  nome_assistente?: string;
  tom?: string;
  regras?: string[];
  horario_atendimento?: string;
  voz?: string;
} | null;

const VOZES = [
  { key: "feminina", label: "Feminina" },
  { key: "masculina", label: "Masculina" },
];

export default function AssistantForm({ identidade }: { identidade: Identidade }) {
  const [error, formAction, pending] = useActionState(
    atualizarIdentidadeAssistente,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label htmlFor="nome_assistente" className="!mb-1">
          Nome de quem atende
        </label>
        <input
          id="nome_assistente"
          name="nome_assistente"
          defaultValue={identidade?.nome_assistente ?? ""}
          placeholder="Ex: Ana"
          className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
        />
      </div>

      <div>
        <label htmlFor="tom" className="!mb-1">
          Tom de voz
        </label>
        <input
          id="tom"
          name="tom"
          defaultValue={identidade?.tom ?? ""}
          placeholder="Ex: caloroso e direto, com emoji com moderação"
          className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
        />
      </div>

      <div>
        <label htmlFor="horario_atendimento" className="!mb-1">
          Horário de atendimento humano
        </label>
        <input
          id="horario_atendimento"
          name="horario_atendimento"
          defaultValue={identidade?.horario_atendimento ?? ""}
          placeholder="Ex: seg-sáb 9h-19h"
          className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
        />
      </div>

      <div>
        <label className="!mb-1">Voz do assistente (áudio, em breve)</label>
        <div className="flex gap-2">
          {VOZES.map((v) => (
            <label
              key={v.key}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-border px-3 py-2.5 text-[12.5px] font-semibold has-[:checked]:border-purple has-[:checked]:bg-purple/5 has-[:checked]:text-purple"
            >
              <input
                type="radio"
                name="voz"
                value={v.key}
                defaultChecked={(identidade?.voz ?? "feminina") === v.key}
                className="accent-[var(--purple)]"
              />
              {v.label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          Define qual voz a ivva vai usar quando o envio de áudio pro
          cliente estiver disponível — hoje ela só responde por texto.
        </p>
      </div>

      <div>
        <label htmlFor="regras" className="!mb-1">
          Regras específicas (uma por linha)
        </label>
        <textarea
          id="regras"
          name="regras"
          rows={4}
          defaultValue={(identidade?.regras ?? []).join("\n")}
          placeholder={"Nunca prometer desconto sem confirmar com o dono\nSempre perguntar o nome na primeira mensagem"}
          className="w-full resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
        />
      </div>

      {error && (
        <p className="text-[12.5px] font-semibold text-coral">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn justify-center bg-ink py-2.5 text-[13px] text-white disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar personalidade"}
      </button>
    </form>
  );
}

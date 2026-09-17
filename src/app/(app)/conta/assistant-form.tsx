"use client";

import { useActionState, useMemo, useState } from "react";
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

const PRESETS_TOM = [
  {
    key: "descontraido",
    label: "Descontraído",
    tom: "descontraído e animado, com emojis moderados — como um amigo que trabalha ali",
    exemplo: "Oi! Tudo certo? Bora marcar esse corte? 😄",
  },
  {
    key: "premium",
    label: "Premium / sofisticado",
    tom: "elegante, formal e atencioso, sem gírias — trata o cliente com cerimônia",
    exemplo: "Olá, seja bem-vindo(a). Será um prazer recebê-lo(a). Qual horário lhe atende melhor?",
  },
  {
    key: "direto",
    label: "Direto ao ponto",
    tom: "direto e objetivo, sem enrolação — poucas palavras, resolve rápido",
    exemplo: "Oi! Qual serviço e que horário você quer?",
  },
  {
    key: "acolhedor",
    label: "Acolhedor / cuidadoso",
    tom: "acolhedor e paciente, sem pressa — bom pra clínica, estética ou saúde",
    exemplo: "Oi, tudo bem? Estou aqui pra te ajudar com o que precisar, sem pressa.",
  },
] as const;

const TOM_PADRAO = "cordial, direto e natural — nada robótico";
const EXEMPLO_PADRAO = "Oi! Tudo bem? Me conta o que você precisa que eu já vejo os horários 🙂";

export default function AssistantForm({ identidade }: { identidade: Identidade }) {
  const [error, formAction, pending] = useActionState(
    atualizarIdentidadeAssistente,
    undefined,
  );

  const [tom, setTom] = useState(identidade?.tom ?? "");

  // O preview mostra o exemplo do preset cujo texto de tom bate com o que
  // está no campo agora — assim ele acompanha tanto o clique num preset
  // quanto uma edição manual que volte a coincidir com um deles. Sem
  // preset batendo, cai no exemplo padrão (sempre tem algo pra mostrar).
  const presetAtivo = useMemo(
    () => PRESETS_TOM.find((p) => p.tom === tom),
    [tom],
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
        <label className="!mb-1">Tom de voz</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS_TOM.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setTom(p.tom)}
              className={`rounded-[10px] border px-3 py-2.5 text-left transition-colors ${
                presetAtivo?.key === p.key
                  ? "border-purple bg-purple/5"
                  : "border-border hover:border-ink/25"
              }`}
            >
              <p
                className={`text-[12.5px] font-bold ${presetAtivo?.key === p.key ? "text-purple" : "text-ink"}`}
              >
                {p.label}
              </p>
              <p className="mt-1 text-[11.5px] italic leading-snug text-ink-faint">
                &ldquo;{p.exemplo}&rdquo;
              </p>
            </button>
          ))}
        </div>

        <textarea
          id="tom"
          name="tom"
          rows={2}
          value={tom}
          onChange={(e) => setTom(e.target.value)}
          placeholder={TOM_PADRAO}
          className="mt-2 w-full resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
        />
        <p className="mt-1 text-[11px] text-ink-faint">
          Escolher um card só preenche o campo — pode editar o texto
          livremente depois.
        </p>

        <div className="mt-2 rounded-[10px] bg-surface-soft px-3.5 py-3">
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
            Assim vai soar:
          </p>
          <p className="text-[13px] italic text-ink-soft">
            &ldquo;{presetAtivo?.exemplo ?? EXEMPLO_PADRAO}&rdquo;
          </p>
        </div>
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

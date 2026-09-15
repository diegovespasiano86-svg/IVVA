"use client";

import { atualizarStatusTarefa } from "./actions";

const STATUS: Record<string, { label: string; classe: string }> = {
  pendente: { label: "Pendente", classe: "bg-surface-soft text-ink-soft" },
  respondeu: { label: "Respondeu", classe: "bg-teal/10 text-teal" },
  agendado: { label: "Agendado", classe: "bg-purple/10 text-purple" },
  sem_resposta: { label: "Sem resposta", classe: "bg-coral/10 text-coral" },
};

export default function StatusSelect({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const atual = STATUS[status] ?? STATUS.pendente;

  return (
    <form action={atualizarStatusTarefa} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`rounded-full border-0 px-3 py-1 text-[11.5px] font-bold ${atual.classe}`}
      >
        {Object.entries(STATUS).map(([key, s]) => (
          <option key={key} value={key}>
            {s.label}
          </option>
        ))}
      </select>
    </form>
  );
}

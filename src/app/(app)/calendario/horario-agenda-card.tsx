import { salvarHorarioAgenda } from "./actions";

const DIAS = [
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sáb"],
  [7, "Dom"],
] as const;

/** Horário que vale para a agenda: o robô só oferece vagas dentro dele. Quem define é o dono do negócio. */
export default function HorarioAgendaCard({ abertura, fechamento, dias }: { abertura: string; fechamento: string; dias: number[] }) {
  return (
    <details className="card group mb-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="text-[13.5px] font-extrabold">
          Horário da agenda{" "}
          <span className="font-normal text-ink-soft">
            · {abertura.slice(0, 5)} às {fechamento.slice(0, 5)}
          </span>
        </span>
        <span className="text-[12.5px] font-semibold text-ink-soft">
          <span className="group-open:hidden">Ajustar</span>
          <span className="hidden group-open:inline">Fechar</span>
        </span>
      </summary>
      <div className="border-t border-border px-4 py-4">
        <p className="mb-3 text-[12.5px] text-ink-soft">
          O robô só oferece vagas nesses dias e horários. Se o robô falar outro horário, confira também as regras em Robô.
        </p>
        <form action={salvarHorarioAgenda} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="abertura" className="!mb-1">Abre às</label>
            <input id="abertura" name="abertura" type="time" required defaultValue={abertura.slice(0, 5)} className="input" />
          </div>
          <div>
            <label htmlFor="fechamento" className="!mb-1">Fecha às</label>
            <input id="fechamento" name="fechamento" type="time" required defaultValue={fechamento.slice(0, 5)} className="input" />
          </div>
          <fieldset className="flex flex-wrap gap-3 text-[13px]">
            <legend className="!mb-1 text-[12.5px] font-semibold">Dias</legend>
            {DIAS.map(([n, nome]) => (
              <label key={n} className="flex items-center gap-1.5 !mb-0">
                <input type="checkbox" name="dias" value={n} defaultChecked={dias.includes(n)} /> {nome}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="btn btn-primary btn-md">Salvar</button>
        </form>
      </div>
    </details>
  );
}

import { salvarHorarioAgenda } from "./actions";

const DIAS = [
  [1, "Segunda"],
  [2, "Terça"],
  [3, "Quarta"],
  [4, "Quinta"],
  [5, "Sexta"],
  [6, "Sábado"],
  [7, "Domingo"],
] as const;

export type HorariosSemana = Record<string, { abre: string; fecha: string }>;

function resumo(h: HorariosSemana): string {
  const aberto = DIAS.filter(([n]) => h[String(n)]);
  if (aberto.length === 0) return "fechado";
  return aberto.map(([n, nome]) => `${nome.slice(0, 3)} ${h[String(n)].abre}–${h[String(n)].fecha}`).join(" · ");
}

/** Horário que vale para a agenda, dia a dia: o robô só oferece vagas dentro dele. Quem define é o dono do negócio. */
export default function HorarioAgendaCard({ horarios }: { horarios: HorariosSemana }) {
  return (
    <details className="card group mb-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 text-[13.5px] font-extrabold">
          Horário da agenda <span className="font-normal text-ink-soft">· {resumo(horarios)}</span>
        </span>
        <span className="shrink-0 text-[12.5px] font-semibold text-ink-soft">
          <span className="group-open:hidden">Ajustar</span>
          <span className="hidden group-open:inline">Fechar</span>
        </span>
      </summary>
      <div className="border-t border-border px-4 py-4">
        <p className="mb-3 text-[12.5px] text-ink-soft">
          Marque os dias em que você atende e o horário de cada um. O robô só oferece vagas dentro disso.
        </p>
        <form action={salvarHorarioAgenda} className="flex flex-col gap-2">
          {DIAS.map(([n, nome]) => {
            const h = horarios[String(n)];
            return (
              <div key={n} className="flex flex-wrap items-center gap-2 text-[13px]">
                <label className="flex w-[100px] items-center gap-2 !mb-0">
                  <input type="checkbox" name={`dia_${n}`} defaultChecked={Boolean(h)} /> {nome}
                </label>
                <input type="time" name={`abre_${n}`} defaultValue={h?.abre ?? "09:00"} className="input w-[110px]" aria-label={`${nome}: abre às`} />
                <span className="text-ink-soft">às</span>
                <input type="time" name={`fecha_${n}`} defaultValue={h?.fecha ?? "18:00"} className="input w-[110px]" aria-label={`${nome}: fecha às`} />
              </div>
            );
          })}
          <button type="submit" className="btn btn-primary btn-md mt-2 w-fit">Salvar horários</button>
        </form>
      </div>
    </details>
  );
}

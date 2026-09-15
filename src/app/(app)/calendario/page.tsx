import { createClient } from "@/lib/supabase/server";
import { criarAgendamento } from "./actions";

export default async function CalendarioPage() {
  const supabase = await createClient();

  const now = new Date();
  const em14dias = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [{ data: profissionais }, { data: contatos }, { data: agendamentos }] =
    await Promise.all([
      supabase
        .from("professionals")
        .select("id, nome, cor")
        .order("nome"),
      supabase.from("contacts").select("id, nome").order("nome"),
      supabase
        .from("appointments")
        .select("id, data_hora, status, contacts(nome), professionals(nome, cor)")
        .eq("status", "agendado")
        .gte("data_hora", now.toISOString())
        .lte("data_hora", em14dias.toISOString())
        .order("data_hora", { ascending: true }),
    ]);

  const porDia = new Map<string, typeof agendamentos>();
  for (const ag of agendamentos ?? []) {
    const dia = new Date(ag.data_hora).toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
    const lista = porDia.get(dia) ?? [];
    lista.push(ag);
    porDia.set(dia, lista);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">
            Calendário
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            Próximos 14 dias, todos os profissionais.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {(profissionais ?? []).map((prof) => (
              <span
                key={prof.id}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: prof.cor }}
                />
                {prof.nome}
              </span>
            ))}
          </div>
        </div>

        <form
          action={criarAgendamento}
          className="card flex flex-wrap items-end gap-2 px-3.5 py-3"
        >
          <div>
            <label htmlFor="contact_id" className="!mb-1">
              Cliente
            </label>
            <select
              id="contact_id"
              name="contact_id"
              required
              className="w-[150px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            >
              <option value="">Selecione…</option>
              {(contatos ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="professional_id" className="!mb-1">
              Profissional
            </label>
            <select
              id="professional_id"
              name="professional_id"
              required
              className="w-[130px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            >
              <option value="">Selecione…</option>
              {(profissionais ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="data_hora" className="!mb-1">
              Data e hora
            </label>
            <input
              id="data_hora"
              name="data_hora"
              type="datetime-local"
              required
              className="rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            />
          </div>
          <button
            type="submit"
            className="btn bg-ink px-4 py-2 text-[12.5px] text-white"
          >
            Agendar
          </button>
        </form>
      </div>

      {porDia.size === 0 ? (
        <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
          Nenhum agendamento nos próximos 14 dias.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {[...porDia.entries()].map(([dia, lista]) => (
            <div key={dia} className="card px-4 py-4">
              <p className="mb-2.5 text-[12.5px] font-bold uppercase tracking-wide text-ink-faint">
                {dia}
              </p>
              <div className="flex flex-col gap-2">
                {lista?.map((ag) => {
                  const contato = ag.contacts as unknown as {
                    nome: string;
                  } | null;
                  const prof = ag.professionals as unknown as {
                    nome: string;
                    cor: string;
                  } | null;
                  return (
                    <div
                      key={ag.id}
                      className="flex items-center justify-between rounded-[10px] border border-border px-3.5 py-2.5 text-[13px]"
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: prof?.cor ?? "#8B7FE8" }}
                        />
                        {contato?.nome ?? "Contato"}
                      </span>
                      <span className="text-ink-soft">
                        {new Date(ag.data_hora).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {prof?.nome}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

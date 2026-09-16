import { createClient } from "@/lib/supabase/server";
import { criarAgendamento } from "./actions";
import CalendarView, { type EventoAgenda } from "./calendar-view";

export default async function CalendarioPage() {
  const supabase = await createClient();

  // Janela ampla (2 meses pra trás, 6 pra frente) — dá pra navegar bastante
  // sem precisar buscar tudo de novo a cada clique de mês.
  const now = new Date();
  const inicio = new Date(now);
  inicio.setMonth(inicio.getMonth() - 2);
  const fim = new Date(now);
  fim.setMonth(fim.getMonth() + 6);

  const [{ data: profissionais }, { data: contatos }, { data: agendamentos }] =
    await Promise.all([
      supabase.from("professionals").select("id, nome, cor").order("nome"),
      supabase.from("contacts").select("id, nome").order("nome"),
      supabase
        .from("appointments")
        .select(
          "id, data_hora, duracao_minutos, servico, status, contacts(nome), professionals(id, nome, cor)",
        )
        .neq("status", "cancelado")
        .gte("data_hora", inicio.toISOString())
        .lte("data_hora", fim.toISOString())
        .order("data_hora", { ascending: true }),
    ]);

  const eventos: EventoAgenda[] = (agendamentos ?? []).map((ag) => {
    const contato = ag.contacts as unknown as { nome: string } | null;
    const prof = ag.professionals as unknown as { nome: string; cor: string } | null;
    const inicio = new Date(ag.data_hora);
    const fim = new Date(inicio.getTime() + (ag.duracao_minutos ?? 30) * 60 * 1000);
    return {
      id: ag.id,
      title: `${contato?.nome ?? "Cliente"}${ag.servico ? " · " + ag.servico : ""}`,
      start: inicio,
      end: fim,
      cor: prof?.cor ?? "#8B7FE8",
      contato: contato?.nome ?? "Cliente",
      profissional: prof?.nome ?? "—",
      servico: ag.servico,
      status: ag.status,
    };
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold">Calendário</h1>
        <p className="text-[13.5px] text-ink-soft">
          Agenda de todos os profissionais — inclui o que o robô marca sozinho pelo WhatsApp.
        </p>
      </div>

      <div className="card mb-4 px-4 py-4">
        <p className="mb-3 text-[13px] font-bold">Novo agendamento manual</p>
        <form action={criarAgendamento} className="flex flex-wrap items-end gap-2">
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
            <label htmlFor="servico" className="!mb-1">
              Serviço
            </label>
            <input
              id="servico"
              name="servico"
              placeholder="Ex: corte e barba"
              className="w-[150px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            />
          </div>
          <div>
            <label htmlFor="duracao_minutos" className="!mb-1">
              Duração (min)
            </label>
            <input
              id="duracao_minutos"
              name="duracao_minutos"
              type="number"
              min={5}
              step={5}
              defaultValue={30}
              className="w-[90px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            />
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
          <button type="submit" className="btn bg-ink px-4 py-2 text-[12.5px] text-white">
            Agendar
          </button>
        </form>
      </div>

      <CalendarView eventos={eventos} profissionais={profissionais ?? []} />
    </div>
  );
}

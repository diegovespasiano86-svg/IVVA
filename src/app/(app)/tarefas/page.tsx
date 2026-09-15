import { createClient } from "@/lib/supabase/server";
import { criarTarefa } from "./actions";
import StatusSelect from "./status-select";

const MOTIVOS: Record<string, string> = {
  upsell: "Upsell",
  cross_sell: "Cross-sell",
  prazo_vencido: "Prazo vencido",
};

export default async function TarefasPage() {
  const supabase = await createClient();

  const [{ data: tarefas }, { data: contatos }] = await Promise.all([
    supabase
      .from("outreach_tasks")
      .select("id, motivo, mensagem_enviada, status, created_at, contacts(nome)")
      .order("created_at", { ascending: false }),
    supabase.from("contacts").select("id, nome").order("nome"),
  ]);

  const pendentes = (tarefas ?? []).filter((t) => t.status === "pendente");

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">
            Tarefas
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            {pendentes.length} pendentes de {tarefas?.length ?? 0} no total.
          </p>
        </div>

        <form
          action={criarTarefa}
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
            <label htmlFor="motivo" className="!mb-1">
              Motivo
            </label>
            <select
              id="motivo"
              name="motivo"
              required
              className="w-[130px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            >
              <option value="">Selecione…</option>
              {Object.entries(MOTIVOS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mensagem_enviada" className="!mb-1">
              Mensagem (opcional)
            </label>
            <input
              id="mensagem_enviada"
              name="mensagem_enviada"
              placeholder="Oferecer assinatura mensal"
              className="w-[200px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            />
          </div>
          <button
            type="submit"
            className="btn bg-ink px-4 py-2 text-[12.5px] text-white"
          >
            + Nova tarefa
          </button>
        </form>
      </div>

      {!tarefas || tarefas.length === 0 ? (
        <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
          Nenhuma tarefa ainda. Quando o robô identificar oportunidade de
          upsell ou cliente com prazo vencido, aparece aqui.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tarefas.map((t) => {
            const contato = t.contacts as unknown as { nome: string } | null;
            return (
              <div
                key={t.id}
                className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-bold">
                      {contato?.nome ?? "Cliente"}
                    </span>
                    <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10.5px] font-bold text-ink-soft">
                      {MOTIVOS[t.motivo] ?? t.motivo}
                    </span>
                  </div>
                  {t.mensagem_enviada && (
                    <p className="mt-1 text-[12.5px] text-ink-faint">
                      &rarr; {t.mensagem_enviada}
                    </p>
                  )}
                </div>

                <StatusSelect id={t.id} status={t.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

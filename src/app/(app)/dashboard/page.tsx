import { createClient } from "@/lib/supabase/server";

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`card px-5 py-4.5 ${accent ? "border-purple/35" : ""}`}>
      <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p
        className={`font-display text-[26px] font-extrabold ${accent ? "text-purple" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { count: conversas },
    { count: contatos },
    { count: agendamentos },
    { data: pagamentos },
    { data: proximos },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString()),
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "agendado")
      .gte("data_hora", new Date().toISOString()),
    supabase
      .from("payments")
      .select("valor_total")
      .gte("created_at", startOfMonth.toISOString()),
    supabase
      .from("appointments")
      .select("id, data_hora, status, contacts(nome)")
      .eq("status", "agendado")
      .gte("data_hora", new Date().toISOString())
      .order("data_hora", { ascending: true })
      .limit(6),
  ]);

  const faturamentoMes = (pagamentos ?? []).reduce(
    (soma, p) => soma + Number(p.valor_total ?? 0),
    0,
  );

  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <div>
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">
            Dashboard
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            Resultado do mês em linguagem de dono de negócio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <KpiCard label="Conversas este mês" value={String(conversas ?? 0)} />
        <KpiCard label="Contatos no CRM" value={String(contatos ?? 0)} />
        <KpiCard
          label="Agendamentos futuros"
          value={String(agendamentos ?? 0)}
        />
        <KpiCard
          label="Faturamento do mês"
          value={money.format(faturamentoMes)}
          accent
        />
      </div>

      <div className="card mt-4 px-5 py-5">
        <p className="mb-1 text-[14px] font-bold">Próximos agendamentos</p>
        <p className="mb-4 text-[12px] text-ink-faint">
          Os 6 mais próximos, de todos os profissionais.
        </p>

        {!proximos || proximos.length === 0 ? (
          <p className="rounded-[10px] bg-surface-soft px-4 py-6 text-center text-[13px] text-ink-faint">
            Ainda sem agendamentos. Assim que o WhatsApp começar a marcar
            horários, eles aparecem aqui.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {proximos.map((ag) => (
              <li
                key={ag.id}
                className="flex items-center justify-between rounded-[10px] border border-border px-4 py-3 text-[13.5px]"
              >
                <span className="font-semibold">
                  {(ag.contacts as unknown as { nome: string } | null)
                    ?.nome ?? "Contato"}
                </span>
                <span className="text-ink-soft">
                  {new Date(ag.data_hora).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

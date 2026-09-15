import { createClient } from "@/lib/supabase/server";

export default async function FaturamentoPage(props: {
  searchParams: Promise<{ profissional?: string }>;
}) {
  const { profissional: profissionalId } = await props.searchParams;
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: profissionais } = await supabase
    .from("professionals")
    .select("id, nome, cor, comissao_pct")
    .order("nome");

  let query = supabase
    .from("payments")
    .select(
      "id, itens, valor_total, comissao_calculada, forma_pagamento, created_at, contacts(nome), professionals(id, nome, cor)",
    )
    .gte("created_at", startOfMonth.toISOString())
    .order("created_at", { ascending: false });

  if (profissionalId) {
    query = query.eq("professional_id", profissionalId);
  }

  const { data: pagamentos } = await query;

  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const faturamentoTotal = (pagamentos ?? []).reduce(
    (soma, p) => soma + Number(p.valor_total ?? 0),
    0,
  );
  const comissaoTotal = (pagamentos ?? []).reduce(
    (soma, p) => soma + Number(p.comissao_calculada ?? 0),
    0,
  );

  const porProfissional = new Map<
    string,
    { nome: string; cor: string; total: number; comissao: number; clientes: Set<string> }
  >();
  for (const p of pagamentos ?? []) {
    const prof = p.professionals as unknown as {
      id: string;
      nome: string;
      cor: string;
    } | null;
    if (!prof) continue;
    const atual = porProfissional.get(prof.id) ?? {
      nome: prof.nome,
      cor: prof.cor,
      total: 0,
      comissao: 0,
      clientes: new Set<string>(),
    };
    atual.total += Number(p.valor_total ?? 0);
    atual.comissao += Number(p.comissao_calculada ?? 0);
    const contato = p.contacts as unknown as { nome: string } | null;
    if (contato) atual.clientes.add(contato.nome);
    porProfissional.set(prof.id, atual);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">
            Faturamento
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            Este mês {profissionalId ? "· filtrado por profissional" : "· visão geral"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <a
            href="/faturamento"
            className={`chip rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${
              !profissionalId
                ? "border-ink bg-ink text-white"
                : "border-border bg-surface text-ink-soft"
            }`}
          >
            Todos
          </a>
          {(profissionais ?? []).map((p) => (
            <a
              key={p.id}
              href={`/faturamento?profissional=${p.id}`}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${
                profissionalId === p.id
                  ? "border-ink bg-ink text-white"
                  : "border-border bg-surface text-ink-soft"
              }`}
            >
              {p.nome}
            </a>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3.5 md:grid-cols-3">
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Faturamento do mês
          </p>
          <p className="font-display text-[26px] font-extrabold">
            {money.format(faturamentoTotal)}
          </p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Comissão total
          </p>
          <p className="font-display text-[26px] font-extrabold text-purple">
            {money.format(comissaoTotal)}
          </p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Atendimentos pagos
          </p>
          <p className="font-display text-[26px] font-extrabold">
            {pagamentos?.length ?? 0}
          </p>
        </div>
      </div>

      {!profissionalId && (
        <div className="card mb-4 px-5 py-5">
          <p className="mb-3 text-[14px] font-bold">Por profissional</p>
          {porProfissional.size === 0 ? (
            <p className="rounded-[10px] bg-surface-soft px-4 py-6 text-center text-[13px] text-ink-faint">
              Sem pagamentos este mês.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...porProfissional.values()]
                .sort((a, b) => b.total - a.total)
                .map((prof) => (
                  <div
                    key={prof.nome}
                    className="flex items-center justify-between rounded-[10px] border border-border px-4 py-3"
                  >
                    <span className="flex items-center gap-2.5 text-[13.5px] font-semibold">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: prof.cor }}
                      />
                      {prof.nome}
                      <span className="font-normal text-ink-faint">
                        · {prof.clientes.size} clientes
                      </span>
                    </span>
                    <span className="flex gap-4 text-[13.5px]">
                      <span className="font-semibold">
                        {money.format(prof.total)}
                      </span>
                      <span className="text-purple">
                        {money.format(prof.comissao)}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="card px-5 py-5">
        <p className="mb-3 text-[14px] font-bold">Atendimentos</p>
        {!pagamentos || pagamentos.length === 0 ? (
          <p className="rounded-[10px] bg-surface-soft px-4 py-6 text-center text-[13px] text-ink-faint">
            Nenhum atendimento pago este mês.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pagamentos.map((p) => {
              const contato = p.contacts as unknown as { nome: string } | null;
              const itens = p.itens as { servico: string }[] | null;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-[10px] border border-border px-4 py-3 text-[13px]"
                >
                  <span className="font-semibold">{contato?.nome ?? "—"}</span>
                  <span className="text-ink-soft">
                    {itens?.[0]?.servico ?? "—"}
                  </span>
                  <span className="font-semibold">
                    {money.format(Number(p.valor_total))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

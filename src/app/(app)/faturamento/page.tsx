import { createClient } from "@/lib/supabase/server";
import { LineAreaChart, HBarList, CardVazio } from "@/components/charts";

export default async function FaturamentoPage(props: {
  searchParams: Promise<{ profissional?: string }>;
}) {
  const { profissional: profissionalId } = await props.searchParams;
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const inicio6meses = new Date();
  inicio6meses.setMonth(inicio6meses.getMonth() - 5);
  inicio6meses.setDate(1);
  inicio6meses.setHours(0, 0, 0, 0);

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

  const [{ data: pagamentos }, { data: pagamentos6meses }] = await Promise.all([
    query,
    supabase
      .from("payments")
      .select("valor_total, created_at, itens")
      .gte("created_at", inicio6meses.toISOString()),
  ]);

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
  const clientesAtendidos = new Set(
    (pagamentos ?? [])
      .map((p) => (p.contacts as unknown as { nome: string } | null)?.nome)
      .filter(Boolean),
  ).size;
  const ticketMedio = pagamentos?.length
    ? faturamentoTotal / pagamentos.length
    : 0;

  const porProfissional = new Map<
    string,
    {
      nome: string;
      cor: string;
      total: number;
      comissao: number;
      comissaoPct: number;
      clientes: Set<string>;
      servicos: Map<string, number>;
    }
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
      comissaoPct: 0,
      clientes: new Set<string>(),
      servicos: new Map<string, number>(),
    };
    atual.total += Number(p.valor_total ?? 0);
    atual.comissao += Number(p.comissao_calculada ?? 0);
    const contato = p.contacts as unknown as { nome: string } | null;
    if (contato) atual.clientes.add(contato.nome);
    const itens = p.itens as { servico: string }[] | null;
    for (const item of itens ?? []) {
      if (!item.servico) continue;
      atual.servicos.set(item.servico, (atual.servicos.get(item.servico) ?? 0) + 1);
    }
    porProfissional.set(prof.id, atual);
  }
  // % de comissão exibida na linha: usa o cadastro do profissional (fixo),
  // não uma média — evita arredondar diferente do que o Checkout usou.
  for (const prof of profissionais ?? []) {
    const linha = porProfissional.get(prof.id);
    if (linha) linha.comissaoPct = Number(prof.comissao_pct ?? 0);
  }

  // Faturamento por mês — últimos 6 meses, sempre com todos presentes.
  const porMes = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(inicio6meses);
    d.setMonth(d.getMonth() + i);
    porMes.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  const contagemServicosGeral = new Map<string, number>();
  for (const p of pagamentos6meses ?? []) {
    const d = new Date(p.created_at);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (porMes.has(chave)) {
      porMes.set(chave, (porMes.get(chave) ?? 0) + Number(p.valor_total ?? 0));
    }
    const itens = p.itens as { servico: string }[] | null;
    for (const item of itens ?? []) {
      if (!item.servico) continue;
      contagemServicosGeral.set(
        item.servico,
        (contagemServicosGeral.get(item.servico) ?? 0) +
          Number(p.valor_total ?? 0) / (itens?.length || 1),
      );
    }
  }
  const pontosFaturamento = [...porMes.entries()].map(([chave, valor]) => {
    const [ano, mes] = chave.split("-");
    const rotulo = new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString(
      "pt-BR",
      { month: "short" },
    );
    return { rotulo: rotulo.replace(".", ""), valor: Math.round(valor) };
  });
  const topServicosGeral = [...contagemServicosGeral.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rotulo, valor]) => ({ rotulo, valor: Math.round(valor) }));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">
            Faturamento
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            Este mês {profissionalId ? "· filtrado por profissional" : "· visão geral"} · comissão calculada a partir do Checkout.
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
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${
                profissionalId === p.id
                  ? "border-ink bg-ink text-white"
                  : "border-border bg-surface text-ink-soft"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.cor }}
              />
              {p.nome}
            </a>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3.5 md:grid-cols-4">
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
            Comissão a pagar
          </p>
          <p className="font-display text-[26px] font-extrabold text-purple">
            {money.format(comissaoTotal)}
          </p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Ticket médio
          </p>
          <p className="font-display text-[26px] font-extrabold">
            {money.format(ticketMedio)}
          </p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Clientes atendidos
          </p>
          <p className="font-display text-[26px] font-extrabold text-teal">
            {clientesAtendidos}
          </p>
        </div>
      </div>

      {!profissionalId && (
        <div className="card mb-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-surface-soft px-5 py-3">
            <p className="text-[13.5px] font-bold">Por profissional</p>
          </div>
          {porProfissional.size === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-faint">
              Sem pagamentos este mês.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="px-5 py-2.5">Profissional</th>
                    <th className="px-3 py-2.5">Clientes</th>
                    <th className="px-3 py-2.5">Principal serviço</th>
                    <th className="px-3 py-2.5 text-right">Faturamento</th>
                    <th className="px-3 py-2.5 text-right">Comissão</th>
                    <th className="px-5 py-2.5 text-right">A pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {[...porProfissional.values()]
                    .sort((a, b) => b.total - a.total)
                    .map((prof) => {
                      const principal = [...prof.servicos.entries()].sort(
                        (a, b) => b[1] - a[1],
                      )[0]?.[0];
                      return (
                        <tr
                          key={prof.nome}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-5 py-3 font-semibold">
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ background: prof.cor }}
                              />
                              {prof.nome}
                            </span>
                          </td>
                          <td className="px-3 py-3">{prof.clientes.size}</td>
                          <td className="px-3 py-3 text-ink-soft">
                            {principal ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold">
                            {money.format(prof.total)}
                          </td>
                          <td className="px-3 py-3 text-right text-ink-soft">
                            {prof.comissaoPct}%
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-purple">
                            {money.format(prof.comissao)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
        <div className="card px-5 py-5">
          <p className="mb-0.5 text-[14px] font-bold">Faturamento por mês</p>
          <p className="mb-3 text-[12px] text-ink-faint">Últimos 6 meses</p>
          <LineAreaChart pontos={pontosFaturamento} />
        </div>
        <div className="card px-5 py-5">
          <p className="mb-0.5 text-[14px] font-bold">
            Principais serviços (receita)
          </p>
          <p className="mb-3 text-[12px] text-ink-faint">Últimos 6 meses</p>
          {topServicosGeral.length === 0 ? (
            <CardVazio texto="Sem serviços registrados ainda." />
          ) : (
            <HBarList itens={topServicosGeral} />
          )}
        </div>
      </div>

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

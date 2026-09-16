import { createClient } from "@/lib/supabase/server";
import { registrarPagamento } from "./actions";

const FORMAS: { key: string; label: string }[] = [
  { key: "pix", label: "PIX" },
  { key: "credito", label: "Crédito" },
  { key: "debito", label: "Débito" },
  { key: "dinheiro", label: "Dinheiro" },
];

export default async function CheckoutPage(props: {
  searchParams: Promise<{
    appointment_id?: string;
    contact_id?: string;
    professional_id?: string;
    servico?: string;
  }>;
}) {
  const prefill = await props.searchParams;
  const supabase = await createClient();

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date();
  fimHoje.setHours(23, 59, 59, 999);

  const [
    { data: contatos },
    { data: profissionais },
    { data: pagamentos },
    { data: agendamentosHoje },
  ] = await Promise.all([
    supabase.from("contacts").select("id, nome").order("nome"),
    supabase
      .from("professionals")
      .select("id, nome, comissao_pct")
      .order("nome"),
    supabase
      .from("payments")
      .select(
        "id, appointment_id, itens, valor_total, comissao_calculada, forma_pagamento, created_at, contacts(nome), professionals(nome)",
      )
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("appointments")
      .select("id, data_hora, servico, contact_id, professional_id, contacts(nome), professionals(nome)")
      .eq("status", "agendado")
      .gte("data_hora", inicioHoje.toISOString())
      .lte("data_hora", fimHoje.toISOString())
      .order("data_hora", { ascending: true }),
  ]);

  const pagosAppointmentIds = new Set(
    (pagamentos ?? []).map((p) => p.appointment_id).filter(Boolean),
  );
  const aguardandoCheckout = (agendamentosHoje ?? []).filter(
    (a) => !pagosAppointmentIds.has(a.id),
  );

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

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">
            Checkout
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            Registro de pagamento com comissão calculada automaticamente.
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              Últimos 15 · faturado
            </p>
            <p className="font-display text-[18px] font-extrabold">
              {money.format(faturamentoTotal)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              Comissão gerada
            </p>
            <p className="font-display text-[18px] font-extrabold text-purple">
              {money.format(comissaoTotal)}
            </p>
          </div>
        </div>
      </div>

      {aguardandoCheckout.length > 0 && (
        <div className="card mb-4 px-4 py-4">
          <p className="mb-3 text-[13.5px] font-bold">
            Atendimentos de hoje aguardando checkout
          </p>
          <div className="flex flex-wrap gap-2">
            {aguardandoCheckout.map((a) => {
              const contato = a.contacts as unknown as { nome: string } | null;
              const prof = a.professionals as unknown as { nome: string } | null;
              const hora = new Date(a.data_hora).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const params = new URLSearchParams({
                appointment_id: a.id,
                contact_id: a.contact_id,
                professional_id: a.professional_id ?? "",
                servico: a.servico ?? "",
              });
              const ativo = prefill.appointment_id === a.id;
              return (
                <a
                  key={a.id}
                  href={`/checkout?${params.toString()}`}
                  className={`flex items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[12.5px] font-bold ${
                    ativo
                      ? "border-purple bg-purple/5 text-purple"
                      : "border-border bg-surface text-ink-soft hover:border-ink/25"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-purple" />
                  {contato?.nome ?? "Cliente"} · {hora}
                  {prof?.nome ? ` · ${prof.nome}` : ""}
                </a>
              );
            })}
          </div>
        </div>
      )}

      <form
        action={registrarPagamento}
        className="card mb-5 flex flex-wrap items-end gap-3 px-4 py-4"
      >
        <input type="hidden" name="appointment_id" value={prefill.appointment_id ?? ""} />
        <div>
          <label htmlFor="contact_id" className="!mb-1">
            Cliente
          </label>
          <select
            id="contact_id"
            name="contact_id"
            required
            defaultValue={prefill.contact_id ?? ""}
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
            defaultValue={prefill.professional_id ?? ""}
            className="w-[150px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
          >
            <option value="">Selecione…</option>
            {(profissionais ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.comissao_pct}%)
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
            required
            defaultValue={prefill.servico ?? ""}
            placeholder="Corte + barba"
            className="w-[150px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
          />
        </div>

        <div>
          <label htmlFor="valor_total" className="!mb-1">
            Valor (R$)
          </label>
          <input
            id="valor_total"
            name="valor_total"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="120,00"
            className="w-[100px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
          />
        </div>

        <div>
          <label htmlFor="forma_pagamento" className="!mb-1">
            Pagamento
          </label>
          <select
            id="forma_pagamento"
            name="forma_pagamento"
            required
            className="w-[120px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
          >
            <option value="">Selecione…</option>
            {FORMAS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="btn bg-ink px-5 py-2.5 text-[13px] text-white"
        >
          Registrar pagamento
        </button>
      </form>

      {!pagamentos || pagamentos.length === 0 ? (
        <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
          Nenhum pagamento registrado ainda.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Profissional</th>
                <th className="px-4 py-3">Serviço</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((p) => {
                const contato = p.contacts as unknown as {
                  nome: string;
                } | null;
                const prof = p.professionals as unknown as {
                  nome: string;
                } | null;
                const itens = p.itens as { servico: string }[] | null;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold">
                      {contato?.nome ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{prof?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {itens?.[0]?.servico ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-soft capitalize">
                      {p.forma_pagamento}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {money.format(Number(p.valor_total))}
                    </td>
                    <td className="px-4 py-3 text-right text-purple">
                      {money.format(Number(p.comissao_calculada))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

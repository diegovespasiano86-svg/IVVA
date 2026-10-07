import EmptyState from "@/components/empty-state";
import PageHeader from "@/components/page-header";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { temRecurso } from "@/lib/planos";
import CheckoutForm, { type ItemCatalogoCheckout, type PixConfig } from "./checkout-form";
import EstornarBotao from "./estornar-botao";

const FORMA: Record<string, string> = { pix: "Pix", credito: "Crédito", debito: "Débito", dinheiro: "Dinheiro" };

type ItemPagamento = { nome?: string; servico?: string; qtd?: number };

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase
    .from("users")
    .select("role, tenants(plano, pix_chave, pix_beneficiario, pix_cidade)")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const tenant = perfil?.tenants as unknown as { plano: string; pix_chave: string | null; pix_beneficiario: string | null; pix_cidade: string | null } | null;
  const ehDono = perfil?.role === "dono";
  const temComissao = temRecurso(tenant?.plano, "comissao_automatica");
  const pix: PixConfig = tenant?.pix_chave && tenant.pix_beneficiario && tenant.pix_cidade
    ? { chave: tenant.pix_chave, beneficiario: tenant.pix_beneficiario, cidade: tenant.pix_cidade }
    : null;

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date();
  fimHoje.setHours(23, 59, 59, 999);

  const [{ data: contatos }, { data: profissionais }, { data: pagamentos }, { data: agendamentosHoje }, { data: itensCatalogo }] =
    await Promise.all([
      supabase.from("contacts").select("id, nome, telefone").order("nome"),
      supabase.from("professionals").select("id, nome, comissao_pct").order("nome"),
      supabase
        .from("payments")
        .select("id, appointment_id, itens, valor_total, comissao_calculada, forma_pagamento, created_at, contacts(nome), professionals(nome)")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("appointments")
        .select("id, data_hora, servico, contact_id, professional_id, contacts(nome), professionals(nome)")
        .eq("status", "agendado")
        .gte("data_hora", inicioHoje.toISOString())
        .lte("data_hora", fimHoje.toISOString())
        .order("data_hora", { ascending: true }),
      supabase
        .from("products")
        .select("id, tipo, nome, preco, controla_estoque, estoque_atual")
        .eq("ativo", true)
        .in("tipo", ["servico", "venda"])
        .order("nome"),
    ]);

  const catalogo: ItemCatalogoCheckout[] = (itensCatalogo ?? []).map((i) => ({
    id: i.id,
    tipo: i.tipo as "servico" | "venda",
    nome: i.nome,
    preco: Number(i.preco),
    controla: Boolean(i.controla_estoque),
    saldo: Number(i.estoque_atual ?? 0),
  }));

  const pagosAppointmentIds = new Set((pagamentos ?? []).map((p) => p.appointment_id).filter(Boolean));
  const aguardandoCheckout = (agendamentosHoje ?? []).filter((a) => !pagosAppointmentIds.has(a.id));

  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const faturamentoTotal = (pagamentos ?? []).reduce((soma, p) => soma + Number(p.valor_total ?? 0), 0);
  const comissaoTotal = (pagamentos ?? []).reduce((soma, p) => soma + Number(p.comissao_calculada ?? 0), 0);

  const resumoItens = (itens: unknown) =>
    ((itens as ItemPagamento[] | null) ?? [])
      .map((i) => `${(i.qtd ?? 1) > 1 ? `${i.qtd}× ` : ""}${i.nome ?? i.servico ?? "Item"}`)
      .join(", ") || "—";

  return (
    <div>
      <PageHeader
        icon={Wallet}
        title="Checkout"
        subtitle={temComissao ? "Receba, registre serviços e produtos e calcule a comissão automaticamente." : "Receba e registre serviços e produtos dos atendimentos."}
        actions={
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Últimos 15 · faturado</p>
              <p className="font-display text-[18px] font-extrabold">{money.format(faturamentoTotal)}</p>
            </div>
            {temComissao && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Comissão gerada</p>
                <p className="font-display text-[18px] font-extrabold text-purple">{money.format(comissaoTotal)}</p>
              </div>
            )}
          </div>
        }
      />

      {aguardandoCheckout.length > 0 && (
        <div className="card mb-4 px-4 py-4">
          <p className="mb-3 text-[13.5px] font-bold">Atendimentos de hoje aguardando checkout</p>
          <div className="flex flex-wrap gap-2">
            {aguardandoCheckout.map((a) => {
              const contato = a.contacts as unknown as { nome: string } | null;
              const prof = a.professionals as unknown as { nome: string } | null;
              const hora = new Date(a.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
                    ativo ? "border-purple bg-purple/5 text-purple" : "border-border bg-surface text-ink-soft hover:border-ink/25"
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

      <CheckoutForm
        key={prefill.appointment_id ?? "novo"}
        contatos={(contatos ?? []).map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone ?? null }))}
        profissionais={(profissionais ?? []).map((p) => ({ id: p.id, nome: p.nome, comissao_pct: Number(p.comissao_pct ?? 0) }))}
        catalogo={catalogo}
        prefill={{ appointmentId: prefill.appointment_id, contactId: prefill.contact_id, professionalId: prefill.professional_id, servico: prefill.servico }}
        temComissao={temComissao}
        pix={pix}
        ehDono={ehDono}
      />

      {!pagamentos || pagamentos.length === 0 ? (
        <div className="card">
          <EmptyState icon={Wallet} title="Nenhum pagamento registrado" text="Quando um pagamento for registrado, ele aparece aqui com o que foi vendido e a forma de pagamento." />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Profissional</th>
                <th className="px-4 py-3">Itens</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3 text-right">Valor</th>
                {temComissao && <th className="px-4 py-3 text-right">Comissão</th>}
                {ehDono && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((p) => {
                const contato = p.contacts as unknown as { nome: string } | null;
                const prof = p.professionals as unknown as { nome: string } | null;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold">{contato?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{prof?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{resumoItens(p.itens)}</td>
                    <td className="px-4 py-3 text-ink-soft">{FORMA[p.forma_pagamento] ?? p.forma_pagamento}</td>
                    <td className="px-4 py-3 text-right font-semibold">{money.format(Number(p.valor_total))}</td>
                    {temComissao && <td className="px-4 py-3 text-right text-purple">{money.format(Number(p.comissao_calculada))}</td>}
                    {ehDono && (
                      <td className="px-4 py-3 text-right">
                        <EstornarBotao id={p.id} />
                      </td>
                    )}
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

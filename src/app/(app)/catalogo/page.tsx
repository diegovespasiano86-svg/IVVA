import Link from "next/link";
import { Package } from "lucide-react";
import PageHeader from "@/components/page-header";
import EmptyState from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";
import { temRecurso } from "@/lib/planos";
import { custoDaFicha } from "@/lib/catalogo";
import { NovoItem, LinhaItem, CopiarLista, ROTULO_TIPO, type ItemCatalogo, type InsumoOpcao } from "./catalogo-client";

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "servico", label: "Serviços" },
  { id: "venda", label: "Produtos de venda" },
  { id: "insumo", label: "Insumos" },
] as const;

const ROTULO_MOVIMENTO: Record<string, string> = {
  venda: "Venda",
  uso: "Uso interno",
  entrada: "Entrada",
  ajuste: "Ajuste",
  perda: "Perda",
  estorno: "Estorno",
};

export default async function CatalogoPage(props: { searchParams: Promise<{ tipo?: string; aba?: string }> }) {
  const { tipo, aba } = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role, tenants(plano)").eq("id", user?.id ?? "").maybeSingle();
  const ehDono = perfil?.role === "dono";
  const estoqueLiberado = temRecurso((perfil?.tenants as unknown as { plano: string } | null)?.plano, "estoque");

  const filtro = FILTROS.some((f) => f.id === tipo) ? (tipo as string) : "todos";
  const verMovimentos = aba === "movimentos" && estoqueLiberado;
  const verAnalise = aba === "analise" && estoqueLiberado;

  const desde60 = new Date(new Date().getTime() - 60 * 24 * 3600 * 1000).toISOString();
  const [{ data: bruto }, { data: movs }, { data: consumos }, { data: movs60 }] = await Promise.all([
    supabase.from("products").select("id, tipo, nome, categoria, preco, custo, controla_estoque, estoque_atual, estoque_minimo, duracao_minutos, ativo").order("nome"),
    verMovimentos
      ? supabase.from("stock_movements").select("id, tipo, quantidade, saldo_apos, motivo, created_at, products(nome)").order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("product_consumos").select("servico_id, insumo_id, quantidade"),
    verAnalise
      ? supabase.from("stock_movements").select("product_id, tipo, quantidade, created_at").in("tipo", ["venda", "uso"]).gte("created_at", desde60).limit(5000)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const fichas = new Map<string, { insumo_id: string; quantidade: number }[]>();
  for (const c of (consumos ?? []) as { servico_id: string; insumo_id: string; quantidade: number }[]) {
    fichas.set(c.servico_id, [...(fichas.get(c.servico_id) ?? []), { insumo_id: c.insumo_id, quantidade: c.quantidade }]);
  }
  const itens = ((bruto ?? []) as unknown as ItemCatalogo[]).map((i) => ({ ...i, preco: Number(i.preco), custo: Number(i.custo), ficha: fichas.get(i.id) ?? [] }));
  const insumos: InsumoOpcao[] = itens
    .filter((i) => i.ativo && i.controla_estoque && (i.tipo === "insumo" || i.tipo === "venda"))
    .map((i) => ({ id: i.id, nome: i.nome, custo: i.custo }));
  const visiveis = itens.filter((i) => filtro === "todos" || i.tipo === filtro);
  const emAlerta = itens.filter((i) => i.ativo && i.controla_estoque && i.estoque_atual <= i.estoque_minimo).length;
  const contagem = (id: string) => (id === "todos" ? itens.length : itens.filter((i) => i.tipo === id).length);

  return (
    <div>
      <PageHeader
        icon={Package}
        title="Catálogo e estoque"
        subtitle={
          <>
            {itens.filter((i) => i.ativo).length} itens ativos
            {emAlerta > 0 && <span className="ml-1.5 font-semibold text-coral">· {emAlerta} em alerta de estoque mínimo</span>}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/catalogo" className="tab" aria-selected={!verMovimentos && !verAnalise}>Itens</Link>
        {estoqueLiberado && (
          <>
            <Link href="/catalogo?aba=movimentos" className="tab" aria-selected={verMovimentos}>Movimentações de estoque</Link>
            <Link href="/catalogo?aba=analise" className="tab" aria-selected={verAnalise}>Análise e compras</Link>
          </>
        )}
      </div>

      {verAnalise ? (
        <Analise itens={itens} insumos={insumos} movs={(movs60 ?? []) as unknown as { product_id: string; tipo: string; quantidade: number; created_at: string }[]} />
      ) : verMovimentos ? (
        !movs || movs.length === 0 ? (
          <div className="card">
            <EmptyState icon={Package} title="Nenhuma movimentação ainda" text="Vendas no Checkout, entradas, perdas e ajustes aparecem aqui, com data, quantidade e saldo." />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Qtd.</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {(movs as unknown as { id: string; tipo: string; quantidade: number; saldo_apos: number; motivo: string | null; created_at: string; products: { nome: string } | null }[]).map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-ink-soft">{new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-2.5 font-semibold">{m.products?.nome ?? "—"}</td>
                    <td className="px-4 py-2.5">{ROTULO_MOVIMENTO[m.tipo] ?? m.tipo}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${m.quantidade < 0 ? "text-coral" : "text-teal"}`}>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</td>
                    <td className="px-4 py-2.5 text-right">{m.saldo_apos}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{m.motivo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          {ehDono && <NovoItem estoqueLiberado={estoqueLiberado} />}

          <div className="mb-3 flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <Link key={f.id} href={f.id === "todos" ? "/catalogo" : `/catalogo?tipo=${f.id}`} className="tab" aria-selected={filtro === f.id}>
                {f.label} <span className="ml-1 text-ink-faint">{contagem(f.id)}</span>
              </Link>
            ))}
          </div>

          {visiveis.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Package}
                title="Nenhum item por aqui"
                text={ehDono ? "Cadastre serviços, produtos de venda e insumos acima. Eles aparecem no Checkout; o controle de estoque é opcional em cada item." : "O administrador ainda não cadastrou itens."}
              />
            </div>
          ) : (
            <ul className="card overflow-hidden">
              {visiveis.map((i, idx) => (
                <LinhaItem key={i.id} item={i} ehDono={ehDono} estoqueLiberado={estoqueLiberado} insumos={insumos} indice={idx} />
              ))}
            </ul>
          )}
          {!estoqueLiberado && (
            <p className="mt-3 text-[12px] text-ink-faint">
              O catálogo está liberado no seu plano. O controle de estoque (saldo, alertas e histórico) é do plano Profissional em diante; os itens continuam aparecendo no Checkout.
            </p>
          )}
          <p className="sr-only">{Object.values(ROTULO_TIPO).join(", ")}</p>
        </>
      )}
    </div>
  );
}

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Analise({
  itens,
  insumos,
  movs,
}: {
  itens: ItemCatalogo[];
  insumos: InsumoOpcao[];
  movs: { product_id: string; tipo: string; quantidade: number; created_at: string }[];
}) {
  const controlados = itens.filter((i) => i.ativo && i.controla_estoque);
  const valorCusto = controlados.reduce((s, i) => s + i.estoque_atual * i.custo, 0);
  const valorVenda = controlados.filter((i) => i.tipo === "venda").reduce((s, i) => s + i.estoque_atual * i.preco, 0);

  // Lista de compras: repor até o dobro do mínimo.
  const compras = controlados
    .filter((i) => i.estoque_atual <= i.estoque_minimo)
    .map((i) => ({ ...i, comprar: Math.max(1, Math.max(i.estoque_minimo * 2, 2) - i.estoque_atual) }))
    .sort((a, b) => a.estoque_atual - b.estoque_atual);
  const textoCompras = compras.length
    ? "Lista de compras\n" + compras.map((c) => `- ${c.nome}: comprar ${c.comprar} (saldo ${c.estoque_atual}, mínimo ${c.estoque_minimo})`).join("\n")
    : "";

  const corte30 = new Date().getTime() - 30 * 24 * 3600 * 1000;
  const saida30 = new Map<string, number>();
  const ultimoMov = new Map<string, number>();
  for (const m of movs) {
    const quando = new Date(m.created_at).getTime();
    ultimoMov.set(m.product_id, Math.max(ultimoMov.get(m.product_id) ?? 0, quando));
    if (quando >= corte30) saida30.set(m.product_id, (saida30.get(m.product_id) ?? 0) + Math.abs(m.quantidade));
  }
  const maisUsados = [...saida30]
    .map(([id, qtd]) => ({ item: itens.find((i) => i.id === id), qtd }))
    .filter((x): x is { item: ItemCatalogo; qtd: number } => Boolean(x.item))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 6);
  const maxUso = Math.max(1, ...maisUsados.map((x) => x.qtd));
  const parados = controlados.filter((i) => i.estoque_atual > 0 && !ultimoMov.has(i.id));
  const servicos = itens
    .filter((i) => i.ativo && i.tipo === "servico")
    .map((s) => {
      const custo = custoDaFicha(s.ficha, insumos);
      return { s, custo, margem: s.preco > 0 ? ((s.preco - custo) / s.preco) * 100 : 0, temFicha: (s.ficha?.length ?? 0) > 0 };
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { rotulo: "Valor parado em estoque (custo)", valor: dinheiro.format(valorCusto), cor: "text-ink" },
          { rotulo: "Potencial de venda em estoque", valor: dinheiro.format(valorVenda), cor: "text-teal" },
          { rotulo: "Itens para repor", valor: String(compras.length), cor: compras.length ? "text-coral" : "text-teal" },
        ].map((k, n) => (
          <div key={k.rotulo} style={{ "--d": `${n * 60}ms` } as React.CSSProperties} className="card anim-rise px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{k.rotulo}</p>
            <p className={`font-display text-[24px] font-extrabold ${k.cor}`}>{k.valor}</p>
          </div>
        ))}
      </div>

      <section className="card anim-rise px-5 py-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[14.5px] font-extrabold">Lista de compras</h2>
            <p className="text-[12px] text-ink-soft">Itens no mínimo ou abaixo. A sugestão repõe até o dobro do mínimo.</p>
          </div>
          {compras.length > 0 && <CopiarLista texto={textoCompras} />}
        </div>
        {compras.length === 0 ? (
          <p className="rounded-[12px] bg-surface-soft px-4 py-5 text-center text-[13px] text-teal">Tudo certo: nenhum item abaixo do mínimo.</p>
        ) : (
          <ul className="flex flex-col">
            {compras.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 border-b border-border py-2.5 last:border-0">
                <span className="min-w-[180px] flex-1 text-[13.5px] font-semibold">{c.nome}<span className="ml-2 text-[11.5px] font-normal text-ink-faint">{ROTULO_TIPO[c.tipo]}</span></span>
                <span className="text-[12.5px] text-ink-soft">saldo {c.estoque_atual} · mínimo {c.estoque_minimo}</span>
                <span className="rounded-full bg-coral/10 px-3 py-1 text-[12px] font-bold text-coral">comprar {c.comprar}</span>
                {c.custo > 0 && <span className="w-[90px] text-right text-[12px] text-ink-faint">≈ {dinheiro.format(c.comprar * c.custo)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card anim-rise px-5 py-5">
          <h2 className="text-[14.5px] font-extrabold">Mais saíram (30 dias)</h2>
          <p className="mb-3 text-[12px] text-ink-soft">Vendas no Checkout e consumo pelas fichas técnicas.</p>
          {maisUsados.length === 0 ? (
            <p className="rounded-[12px] bg-surface-soft px-4 py-5 text-center text-[13px] text-ink-faint">Sem saídas no período ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {maisUsados.map(({ item, qtd }) => (
                <li key={item.id}>
                  <div className="mb-1 flex justify-between text-[12.5px]"><span className="font-semibold">{item.nome}</span><span className="text-ink-soft">{qtd} un.</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-soft"><div className="h-full rounded-full bg-[linear-gradient(90deg,#2fbf9f,#8b7fe8)] transition-[width] duration-700" style={{ width: `${Math.round((qtd / maxUso) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card anim-rise px-5 py-5">
          <h2 className="text-[14.5px] font-extrabold">Parados há 60 dias</h2>
          <p className="mb-3 text-[12px] text-ink-soft">Com saldo e nenhuma saída. Vale uma promoção ou rever a compra.</p>
          {parados.length === 0 ? (
            <p className="rounded-[12px] bg-surface-soft px-4 py-5 text-center text-[13px] text-teal">Nada parado: tudo teve saída.</p>
          ) : (
            <ul className="flex flex-col">
              {parados.map((i) => (
                <li key={i.id} className="flex items-center justify-between border-b border-border py-2 text-[13px] last:border-0">
                  <span className="font-semibold">{i.nome}</span>
                  <span className="text-ink-soft">{i.estoque_atual} un. · {dinheiro.format(i.estoque_atual * i.custo)} parados</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card anim-rise px-5 py-5">
        <h2 className="text-[14.5px] font-extrabold">Margem dos serviços (sobre insumos)</h2>
        <p className="mb-3 text-[12px] text-ink-soft">Preço do serviço menos o custo dos insumos da ficha técnica. Serviço sem ficha não entra na conta.</p>
        {servicos.length === 0 ? (
          <p className="rounded-[12px] bg-surface-soft px-4 py-5 text-center text-[13px] text-ink-faint">Cadastre serviços no catálogo.</p>
        ) : (
          <ul className="flex flex-col">
            {servicos.map(({ s, custo, margem, temFicha }) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0">
                <span className="min-w-[180px] flex-1 font-semibold">{s.nome}</span>
                <span className="w-[90px] text-right text-ink-soft">{dinheiro.format(s.preco)}</span>
                {temFicha ? (
                  <>
                    <span className="w-[100px] text-right text-ink-faint">custo {dinheiro.format(custo)}</span>
                    <span className={`w-[70px] text-right font-bold ${margem >= 50 ? "text-teal" : margem >= 25 ? "text-ink" : "text-coral"}`}>{margem.toFixed(0)}%</span>
                  </>
                ) : (
                  <span className="text-[12px] text-ink-faint">sem ficha técnica</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

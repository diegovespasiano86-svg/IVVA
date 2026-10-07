import Link from "next/link";
import { Package } from "lucide-react";
import PageHeader from "@/components/page-header";
import EmptyState from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";
import { temRecurso } from "@/lib/planos";
import { NovoItem, LinhaItem, ROTULO_TIPO, type ItemCatalogo } from "./catalogo-client";

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

  const [{ data: bruto }, { data: movs }] = await Promise.all([
    supabase.from("products").select("id, tipo, nome, categoria, preco, custo, controla_estoque, estoque_atual, estoque_minimo, duracao_minutos, ativo").order("nome"),
    verMovimentos
      ? supabase.from("stock_movements").select("id, tipo, quantidade, saldo_apos, motivo, created_at, products(nome)").order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const itens = ((bruto ?? []) as unknown as ItemCatalogo[]).map((i) => ({ ...i, preco: Number(i.preco), custo: Number(i.custo) }));
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
        <Link href="/catalogo" className="tab" aria-selected={!verMovimentos}>Itens</Link>
        {estoqueLiberado && (
          <Link href="/catalogo?aba=movimentos" className="tab" aria-selected={verMovimentos}>Movimentações de estoque</Link>
        )}
      </div>

      {verMovimentos ? (
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
              {visiveis.map((i) => (
                <LinhaItem key={i.id} item={i} ehDono={ehDono} estoqueLiberado={estoqueLiberado} />
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

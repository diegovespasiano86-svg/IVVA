import { createClient } from "@/lib/supabase/server";
import { criarProduto, ajustarEstoque } from "./actions";

export default async function EstoquePage() {
  const supabase = await createClient();

  const { data: produtos } = await supabase
    .from("products")
    .select("id, nome, categoria, preco, estoque_atual, estoque_minimo")
    .order("nome");

  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const emAlerta = (produtos ?? []).filter(
    (p) => p.estoque_atual <= p.estoque_minimo,
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">
            Estoque
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            {produtos?.length ?? 0} produtos
            {emAlerta.length > 0 && (
              <span className="ml-1.5 font-semibold text-coral">
                · {emAlerta.length} em alerta de estoque mínimo
              </span>
            )}
          </p>
        </div>

        <form
          action={criarProduto}
          className="card flex flex-wrap items-end gap-2 px-3.5 py-3"
        >
          <div>
            <label htmlFor="nome" className="!mb-1">
              Produto
            </label>
            <input
              id="nome"
              name="nome"
              required
              placeholder="Shampoo 500ml"
              className="w-[140px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            />
          </div>
          <div>
            <label htmlFor="categoria" className="!mb-1">
              Categoria
            </label>
            <input
              id="categoria"
              name="categoria"
              placeholder="Cabelo"
              className="w-[110px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            />
          </div>
          <div>
            <label htmlFor="preco" className="!mb-1">
              Preço (R$)
            </label>
            <input
              id="preco"
              name="preco"
              type="number"
              step="0.01"
              min="0"
              placeholder="45,00"
              className="w-[90px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            />
          </div>
          <div>
            <label htmlFor="estoque_atual" className="!mb-1">
              Qtd. atual
            </label>
            <input
              id="estoque_atual"
              name="estoque_atual"
              type="number"
              min="0"
              placeholder="10"
              className="w-[80px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            />
          </div>
          <div>
            <label htmlFor="estoque_minimo" className="!mb-1">
              Mínimo
            </label>
            <input
              id="estoque_minimo"
              name="estoque_minimo"
              type="number"
              min="0"
              placeholder="3"
              className="w-[70px] rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[12.5px]"
            />
          </div>
          <button
            type="submit"
            className="btn bg-ink px-4 py-2 text-[12.5px] text-white"
          >
            + Adicionar
          </button>
        </form>
      </div>

      {!produtos || produtos.length === 0 ? (
        <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
          Nenhum produto cadastrado ainda.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Preço</th>
                <th className="px-4 py-3 text-right">Estoque</th>
                <th className="px-4 py-3 text-right">Ajustar</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => {
                const baixo = p.estoque_atual <= p.estoque_minimo;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold">{p.nome}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {p.categoria ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money.format(Number(p.preco))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                          baixo
                            ? "bg-coral/10 text-coral"
                            : "bg-surface-soft text-ink-soft"
                        }`}
                      >
                        {p.estoque_atual} un.
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <form action={ajustarEstoque}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="delta" value="-1" />
                          <button
                            type="submit"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-ink-soft hover:bg-surface-soft"
                          >
                            −
                          </button>
                        </form>
                        <form action={ajustarEstoque}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="delta" value="1" />
                          <button
                            type="submit"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-ink-soft hover:bg-surface-soft"
                          >
                            +
                          </button>
                        </form>
                      </div>
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

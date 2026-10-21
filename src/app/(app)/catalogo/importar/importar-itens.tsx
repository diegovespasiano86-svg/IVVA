"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp } from "lucide-react";
import { lerCsv } from "@/lib/clientes";
import { montarLinha } from "@/lib/catalogo-importacao";
import { importarItens, type ResultadoImportacaoItens } from "../importar-actions";

const CAMPOS = [
  { id: "nome", label: "Nome do item", obrigatorio: true },
  { id: "tipo", label: "Tipo (serviço, produto ou insumo)", obrigatorio: false },
  { id: "preco", label: "Preço de venda", obrigatorio: false },
  { id: "custo", label: "Custo", obrigatorio: false },
  { id: "estoque", label: "Estoque atual", obrigatorio: false },
  { id: "minimo", label: "Estoque mínimo", obrigatorio: false },
  { id: "categoria", label: "Categoria", obrigatorio: false },
  { id: "duracao", label: "Duração em minutos (serviços)", obrigatorio: false },
] as const;
type CampoId = (typeof CAMPOS)[number]["id"];

const PISTAS: Record<CampoId, RegExp> = {
  nome: /nome|produto|item|descri/i,
  tipo: /tipo/i,
  preco: /pre[cç]o|valor|venda/i,
  custo: /custo|compra/i,
  estoque: /estoque|saldo|quantidade|qtd/i,
  minimo: /m[ií]nimo|minimo/i,
  categoria: /categoria|grupo|marca/i,
  duracao: /dura|minutos|tempo/i,
};

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ITENS = 500;
const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const ROTULO_TIPO = { servico: "Serviço", venda: "Produto", insumo: "Insumo" } as const;

export default function ImportarItens({ estoqueLiberado }: { estoqueLiberado: boolean }) {
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Partial<Record<CampoId, number>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacaoItens | null>(null);
  const [pendente, iniciar] = useTransition();

  const cabecalho = linhas[0] ?? [];
  const dados = useMemo(() => linhas.slice(1), [linhas]);

  async function aoEscolher(file: File | undefined) {
    setErro(null);
    setResultado(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setErro("Arquivo muito grande (máximo 2 MB).");
    const l = lerCsv(await file.text());
    if (l.length < 2) return setErro("Não encontrei itens nesse arquivo. Confira se a primeira linha tem os títulos das colunas.");
    setArquivo(file.name);
    setLinhas(l);
    const sugerido: Partial<Record<CampoId, number>> = {};
    const usados = new Set<number>();
    for (const c of CAMPOS) {
      const i = l[0].findIndex((h, idx) => !usados.has(idx) && PISTAS[c.id].test(h));
      if (i >= 0) {
        sugerido[c.id] = i;
        usados.add(i);
      }
    }
    setMapa(sugerido);
  }

  const prontas = useMemo(() => {
    if (mapa.nome === undefined) return [];
    return dados.map((r) => {
      const bruto: Record<string, string> = {};
      for (const c of CAMPOS) if (mapa[c.id] !== undefined) bruto[c.id] = r[mapa[c.id]!] ?? "";
      return { bruto, linha: montarLinha(bruto) };
    });
  }, [dados, mapa]);

  const validas = prontas.filter((p) => p.linha);
  const invalidas = prontas.length - validas.length;
  const podeImportar = validas.length > 0 && validas.length <= MAX_ITENS && !pendente;

  function importar() {
    setErro(null);
    iniciar(async () => {
      const r = await importarItens(validas.map((p) => p.bruto));
      setResultado(r);
      if (!r.ok) setErro(r.erro ?? "Não foi possível importar.");
    });
  }

  if (resultado?.ok) {
    return (
      <div className="card px-6 py-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e3f4ef] text-teal">
          <CheckCircle2 size={28} />
        </span>
        <h2 className="mt-4 text-[20px] font-extrabold">Importação concluída</h2>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          <strong className="text-ink">{resultado.inseridos}</strong> itens novos
          {resultado.comEstoque > 0 && <> · {resultado.comEstoque} com estoque inicial lançado</>}
          {resultado.jaExistiam > 0 && <> · {resultado.jaExistiam} já estavam no catálogo</>}
          {resultado.repetidosNoArquivo > 0 && <> · {resultado.repetidosNoArquivo} repetidos no arquivo</>}
          {resultado.invalidos > 0 && <> · {resultado.invalidos} ignorados (sem nome ou valor inválido)</>}
        </p>
        {resultado.estoqueIgnorado && (
          <p className="mx-auto mt-3 max-w-md rounded-xl bg-surface-soft px-4 py-2.5 text-[12.5px] text-ink-soft">
            O controle de estoque é do plano Profissional em diante, então os saldos da planilha não foram lançados. Os itens já aparecem no Checkout.
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/catalogo" className="btn btn-primary btn-md">Ver o catálogo</Link>
          <button type="button" onClick={() => { setResultado(null); setLinhas([]); setArquivo(null); }} className="btn btn-secondary btn-md">
            Importar outro arquivo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card px-5 py-5">
        <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-purple">Passo 1</p>
        <h2 className="mb-1 text-[16px] font-extrabold">Escolha o arquivo</h2>
        <p className="mb-4 text-[12.5px] text-ink-soft">
          Planilha em <strong>.csv</strong> (no Excel: Arquivo, Salvar como, CSV). A primeira linha deve ter os títulos das colunas. Até {MAX_ITENS} itens por vez. Só o <strong>nome</strong> é obrigatório. Itens que já existem no catálogo (mesmo nome e tipo) são pulados.
          <a href="/modelo-importacao-catalogo.csv" download className="ml-1 font-bold text-purple underline-offset-2 hover:underline">
            Baixar a planilha modelo
          </a>
        </p>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-bg px-6 py-8 text-center transition-colors hover:border-purple hover:bg-[#f6f4fe]">
          <FileUp size={26} className="text-purple" />
          <span className="text-[13.5px] font-bold">{arquivo ?? "Clique para escolher o arquivo .csv"}</span>
          <input type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={(e) => aoEscolher(e.target.files?.[0])} />
        </label>
        {erro && <p className="mt-3 rounded-xl bg-[#fdece9] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#8f2a1c]">{erro}</p>}
      </section>

      {linhas.length > 1 && (
        <section className="card px-5 py-5">
          <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-purple">Passo 2</p>
          <h2 className="mb-3 text-[16px] font-extrabold">Confira as colunas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS.map((c) => (
              <div key={c.id}>
                <label htmlFor={`m-${c.id}`}>
                  {c.label} {c.obrigatorio && <span className="text-coral">*</span>}
                </label>
                <select
                  id={`m-${c.id}`}
                  className="select"
                  value={mapa[c.id] ?? ""}
                  onChange={(e) => setMapa((m) => ({ ...m, [c.id]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                >
                  <option value="">{c.obrigatorio ? "Escolha a coluna…" : "Não importar"}</option>
                  {cabecalho.map((h, i) => (
                    <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {!estoqueLiberado && mapa.estoque !== undefined && (
            <p className="mt-3 rounded-xl bg-surface-soft px-4 py-2.5 text-[12.5px] text-ink-soft">
              Seu plano não inclui controle de estoque: os itens entram no catálogo, mas os saldos não serão lançados.
            </p>
          )}

          {prontas.length > 0 && (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge badge-success">{validas.length} prontos para importar</span>
                {invalidas > 0 && <span className="badge badge-warn">{invalidas} serão ignorados (sem nome ou valor inválido)</span>}
              </div>
              {validas.length > MAX_ITENS && <p className="mt-2 text-[12.5px] font-semibold text-coral">Passou de {MAX_ITENS}. Divida o arquivo em partes.</p>}
              <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                <table className="table-clean">
                  <thead>
                    <tr><th>Nome</th><th>Tipo</th><th>Preço</th><th>Custo</th><th>Estoque</th></tr>
                  </thead>
                  <tbody>
                    {prontas.slice(0, 8).map((p, i) => (
                      <tr key={i} className={p.linha ? "" : "opacity-50"}>
                        <td>{p.linha?.nome ?? <span className="text-coral">{p.bruto.nome || "—"} (inválido)</span>}</td>
                        <td>{p.linha ? ROTULO_TIPO[p.linha.tipo] : "—"}</td>
                        <td>{p.linha ? dinheiro.format(p.linha.preco) : "—"}</td>
                        <td>{p.linha ? dinheiro.format(p.linha.custo) : "—"}</td>
                        <td>{p.linha && p.linha.tipo !== "servico" ? p.linha.estoque : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5">
                <button type="button" onClick={importar} disabled={!podeImportar} className={`btn btn-primary btn-lg ${pendente ? "btn-loading" : ""}`}>
                  Importar {validas.length} {validas.length === 1 ? "item" : "itens"}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

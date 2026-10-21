"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp, Info } from "lucide-react";
import { lerCsv } from "@/lib/clientes";
import { inicioDoMesAtual, montarVenda, ROTULO_MOTIVO, type Forma, type MotivoRecusa, type VendaBruta, type VendaPronta } from "@/lib/vendas-importacao";
import { desfazerImportacaoVendas, importarVendas, type ResultadoVendas } from "../importar-vendas-actions";

const CAMPOS = [
  { id: "data", label: "Data da venda", obrigatorio: true },
  { id: "telefone", label: "Telefone / WhatsApp do cliente", obrigatorio: true },
  { id: "valor", label: "Valor pago", obrigatorio: true },
  { id: "forma", label: "Forma de pagamento", obrigatorio: false },
  { id: "nome", label: "Nome do cliente (para cadastrar quem ainda não existe)", obrigatorio: false },
  { id: "descricao", label: "O que foi vendido", obrigatorio: false },
  { id: "profissional", label: "Profissional", obrigatorio: false },
] as const;
type CampoId = (typeof CAMPOS)[number]["id"];

const PISTAS: Record<CampoId, RegExp> = {
  data: /data|dia|quando/i,
  telefone: /tel|cel|whats|fone|phone/i,
  valor: /valor|total|pago|pre[cç]o/i,
  forma: /forma|pagamento|meio/i,
  nome: /nome|cliente/i,
  descricao: /descri|servi|produto|item|procedimento/i,
  profissional: /profission|atendente|funcion/i,
};

const FORMAS: { id: Forma; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "credito", label: "Crédito" },
  { id: "debito", label: "Débito" },
  { id: "dinheiro", label: "Dinheiro" },
];

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_LINHAS = 2000;
const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function resumoRecusas(r: Partial<Record<MotivoRecusa, number>>): string[] {
  return (Object.entries(r) as [MotivoRecusa, number][]).filter(([, n]) => n > 0).map(([m, n]) => `${n} ${ROTULO_MOTIVO[m]}`);
}

export default function ImportarVendas() {
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Partial<Record<CampoId, number>>>({});
  const [formaPadrao, setFormaPadrao] = useState<Forma>("pix");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoVendas | null>(null);
  const [desfeito, setDesfeito] = useState<number | null>(null);
  const [pendente, iniciar] = useTransition();

  const cabecalho = linhas[0] ?? [];
  const dados = useMemo(() => linhas.slice(1), [linhas]);
  const limite = inicioDoMesAtual();
  const [ano, mes] = limite.split("-");

  async function aoEscolher(file: File | undefined) {
    setErro(null);
    setResultado(null);
    setDesfeito(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setErro("Arquivo muito grande (máximo 2 MB).");
    const l = lerCsv(await file.text());
    if (l.length < 2) return setErro("Não encontrei vendas nesse arquivo. Confira se a primeira linha tem os títulos das colunas.");
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

  const brutas = useMemo<VendaBruta[]>(() => {
    if (mapa.data === undefined || mapa.telefone === undefined || mapa.valor === undefined) return [];
    return dados.map((r) => {
      const b: Record<string, string> = {};
      for (const c of CAMPOS) if (mapa[c.id] !== undefined) b[c.id] = r[mapa[c.id]!] ?? "";
      return b;
    });
  }, [dados, mapa]);

  const analise = useMemo(() => {
    const prontas: { bruta: VendaBruta; venda: VendaPronta }[] = [];
    const recusadas: Partial<Record<MotivoRecusa, number>> = {};
    for (const b of brutas) {
      const m = montarVenda(b, formaPadrao);
      if ("motivo" in m) recusadas[m.motivo] = (recusadas[m.motivo] ?? 0) + 1;
      else prontas.push({ bruta: b, venda: m.venda });
    }
    return { prontas, recusadas };
  }, [brutas, formaPadrao]);

  const validas = analise.prontas;
  const recusas = resumoRecusas(analise.recusadas);
  const total = validas.reduce((s, p) => s + p.venda.valor, 0);
  const podeImportar = validas.length > 0 && validas.length <= MAX_LINHAS && !pendente;

  function importar() {
    setErro(null);
    iniciar(async () => {
      const r = await importarVendas(validas.map((p) => p.bruta), formaPadrao);
      setResultado(r);
      if (!r.ok) setErro(r.erro ?? "Não foi possível importar.");
    });
  }

  function desfazer() {
    if (!resultado?.importacaoId) return;
    iniciar(async () => {
      const r = await desfazerImportacaoVendas(resultado.importacaoId!);
      if (r.ok) setDesfeito(r.apagadas);
      else setErro(r.erro ?? "Não consegui desfazer.");
    });
  }

  if (resultado?.ok) {
    const rec = resumoRecusas(resultado.recusadas);
    return (
      <div className="card px-6 py-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e3f4ef] text-teal">
          <CheckCircle2 size={28} />
        </span>
        <h2 className="mt-4 text-[20px] font-extrabold">{desfeito !== null ? "Importação desfeita" : "Importação concluída"}</h2>
        {desfeito !== null ? (
          <p className="mt-1 text-[13.5px] text-ink-soft">{desfeito} vendas removidas. Os relatórios voltaram ao que eram antes.</p>
        ) : (
          <p className="mt-1 text-[13.5px] text-ink-soft">
            <strong className="text-ink">{resultado.inseridas}</strong> vendas importadas
            {resultado.clientesNovos > 0 && <> · {resultado.clientesNovos} clientes novos cadastrados</>}
            {resultado.jaExistiam > 0 && <> · {resultado.jaExistiam} já estavam importadas</>}
            {resultado.semCliente > 0 && <> · {resultado.semCliente} sem cliente (telefone não cadastrado e sem nome)</>}
            {rec.length > 0 && <> · ignoradas: {rec.join(", ")}</>}
          </p>
        )}
        {erro && <p className="mx-auto mt-3 max-w-md rounded-xl bg-[#fdece9] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#8f2a1c]">{erro}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/relatorios?aba=financeiro&periodo=tudo" className="btn btn-primary btn-md">Ver nos relatórios</Link>
          {desfeito === null && resultado.importacaoId && (
            <button type="button" onClick={desfazer} disabled={pendente} className="btn btn-secondary btn-md">Desfazer esta importação</button>
          )}
          <button type="button" onClick={() => { setResultado(null); setLinhas([]); setArquivo(null); setDesfeito(null); }} className="btn btn-secondary btn-md">
            Importar outro arquivo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-xl bg-surface-soft px-4 py-3 text-[12.5px] text-ink-soft">
        <Info size={16} className="mt-0.5 shrink-0 text-purple" />
        <span>
          Só entram vendas de <strong>meses anteriores a {mes}/{ano}</strong>. As do mês atual você lança no Checkout, que dá baixa no estoque e calcula a comissão. As importadas não mexem no estoque (o saldo de hoje já reflete essas vendas) nem geram comissão.
        </span>
      </p>

      <section className="card px-5 py-5">
        <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-purple">Passo 1</p>
        <h2 className="mb-1 text-[16px] font-extrabold">Escolha o arquivo</h2>
        <p className="mb-4 text-[12.5px] text-ink-soft">
          Planilha em <strong>.csv</strong> (no Excel: Arquivo, Salvar como, CSV), uma linha por venda. Obrigatórios: <strong>data</strong>, <strong>telefone do cliente</strong> e <strong>valor</strong>. Se o telefone ainda não estiver na sua base, o cliente é cadastrado quando houver o nome. Até {MAX_LINHAS} vendas por vez.
          <a href="/modelo-importacao-vendas.csv" download className="ml-1 font-bold text-purple underline-offset-2 hover:underline">
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
            <div>
              <label htmlFor="forma-padrao">Forma de pagamento quando a planilha não informar</label>
              <select id="forma-padrao" className="select" value={formaPadrao} onChange={(e) => setFormaPadrao(e.target.value as Forma)}>
                {FORMAS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          {brutas.length > 0 && (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge badge-success">{validas.length} prontas · {dinheiro.format(total)}</span>
                {recusas.length > 0 && <span className="badge badge-warn">Serão ignoradas: {recusas.join(", ")}</span>}
              </div>
              {validas.length > MAX_LINHAS && <p className="mt-2 text-[12.5px] font-semibold text-coral">Passou de {MAX_LINHAS}. Divida o arquivo em partes.</p>}
              <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                <table className="table-clean">
                  <thead>
                    <tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Forma</th></tr>
                  </thead>
                  <tbody>
                    {validas.slice(0, 8).map((p, i) => (
                      <tr key={i}>
                        <td>{p.venda.quando.slice(8, 10)}/{p.venda.quando.slice(5, 7)}/{p.venda.quando.slice(0, 4)}</td>
                        <td>{p.venda.nome || p.venda.telefone}</td>
                        <td>{dinheiro.format(p.venda.valor)}</td>
                        <td>{FORMAS.find((f) => f.id === p.venda.forma)?.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5">
                <button type="button" onClick={importar} disabled={!podeImportar} className={`btn btn-primary btn-lg ${pendente ? "btn-loading" : ""}`}>
                  Importar {validas.length} {validas.length === 1 ? "venda" : "vendas"}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}


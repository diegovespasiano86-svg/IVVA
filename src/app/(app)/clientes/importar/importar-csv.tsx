"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp, ShieldCheck } from "lucide-react";
import { lerCsv, normalizarTelefone } from "@/lib/clientes";
import { importarContatos, type ResultadoImportacao } from "../actions";

const CAMPOS = [
  { id: "nome", label: "Nome", obrigatorio: true },
  { id: "telefone", label: "Telefone / WhatsApp", obrigatorio: true },
  { id: "email", label: "E-mail", obrigatorio: false },
  { id: "aniversario", label: "Aniversário", obrigatorio: false },
  { id: "instagram", label: "Instagram", obrigatorio: false },
  { id: "comoConheceu", label: "Como conheceu", obrigatorio: false },
] as const;
type CampoId = (typeof CAMPOS)[number]["id"];

const PISTAS: Record<CampoId, RegExp> = {
  nome: /nome|name|cliente|contato/i,
  telefone: /tel|cel|whats|fone|phone|numero|número/i,
  email: /mail/i,
  aniversario: /anivers|nasc|birth/i,
  instagram: /insta/i,
  comoConheceu: /conheceu|origem|indica/i,
};

const MAX_BYTES = 2 * 1024 * 1024;

export default function ImportarCsv() {
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Partial<Record<CampoId, number>>>({});
  const [extrasSel, setExtrasSel] = useState<Record<number, boolean>>({});
  const [autorizado, setAutorizado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [pendente, iniciar] = useTransition();

  const cabecalho = linhas[0] ?? [];
  const dados = useMemo(() => linhas.slice(1), [linhas]);

  async function aoEscolher(file: File | undefined) {
    setErro(null);
    setResultado(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setErro("Arquivo muito grande (máximo 2 MB).");
      return;
    }
    const texto = await file.text();
    const l = lerCsv(texto);
    if (l.length < 2) {
      setErro("Não encontrei linhas de clientes nesse arquivo. Confira se a primeira linha tem os títulos das colunas.");
      return;
    }
    setArquivo(file.name);
    setLinhas(l);
    const sugerido: Partial<Record<CampoId, number>> = {};
    l[0].forEach((h, i) => {
      for (const c of CAMPOS) if (sugerido[c.id] === undefined && PISTAS[c.id].test(h)) sugerido[c.id] = i;
    });
    setMapa(sugerido);
    setExtrasSel({});
  }

  // Colunas que não foram ligadas a nenhum campo: o dono escolhe se quer trazê-las como informação extra.
  const usadas = new Set(Object.values(mapa).filter((v): v is number => v !== undefined));
  const colunasExtras = cabecalho.map((h, i) => ({ h: h.trim(), i })).filter((c) => c.h && !usadas.has(c.i));
  const extrasAtivas = colunasExtras.filter((c) => extrasSel[c.i] !== false);

  const prontas = useMemo(() => {
    if (mapa.nome === undefined || mapa.telefone === undefined) return [];
    return dados.map((r) => ({
      nome: (r[mapa.nome!] ?? "").trim(),
      telefone: r[mapa.telefone!] ?? "",
      email: mapa.email !== undefined ? r[mapa.email] ?? "" : "",
      instagram: mapa.instagram !== undefined ? r[mapa.instagram] ?? "" : "",
      aniversario: mapa.aniversario !== undefined ? r[mapa.aniversario] ?? "" : "",
      comoConheceu: mapa.comoConheceu !== undefined ? r[mapa.comoConheceu] ?? "" : "",
      extras: Object.fromEntries(extrasAtivas.map((c) => [c.h, (r[c.i] ?? "").trim()])),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, mapa, extrasSel, cabecalho]);

  const validas = prontas.filter((p) => p.nome && normalizarTelefone(p.telefone));
  const invalidas = prontas.length - validas.length;
  const podeImportar = validas.length > 0 && validas.length <= 2000 && !pendente;

  function importar() {
    setErro(null);
    iniciar(async () => {
      const r = await importarContatos(validas, autorizado);
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
          <strong className="text-ink">{resultado.inseridos}</strong> clientes novos
          {resultado.jaExistiam > 0 && <> · {resultado.jaExistiam} já estavam na sua base</>}
          {resultado.duplicadosNoArquivo > 0 && <> · {resultado.duplicadosNoArquivo} repetidos no arquivo</>}
          {resultado.invalidos > 0 && <> · {resultado.invalidos} ignorados (sem nome ou com telefone inválido)</>}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/clientes" className="btn btn-primary btn-md">
            Ver meus clientes
          </Link>
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
          Planilha em <strong>.csv</strong> (no Excel: Arquivo, Salvar como, CSV). A primeira linha deve ter os títulos das colunas. Até 2.000 clientes por vez. Só <strong>nome</strong> e <strong>telefone</strong> são obrigatórios; você pode acrescentar outras colunas, o modelo é só um ponto de partida.
          <a href="/modelo-importacao-clientes.csv" download className="ml-1 font-bold text-purple underline-offset-2 hover:underline">
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
        <>
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
                      <option key={i} value={i}>
                        {h || `Coluna ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {colunasExtras.length > 0 && (
              <div className="mt-5 rounded-xl border border-border bg-bg px-4 py-3.5">
                <p className="text-[13px] font-bold">Outras informações da sua planilha</p>
                <p className="mb-2 mt-0.5 text-[12px] text-ink-soft">
                  Essas colunas não têm campo próprio. Marque as que você quer guardar: elas entram como uma nota na ficha de cada cliente.
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {colunasExtras.map((c) => (
                    <label key={c.i} className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold">
                      <input
                        type="checkbox"
                        checked={extrasSel[c.i] !== false}
                        onChange={(e) => setExtrasSel((s) => ({ ...s, [c.i]: e.target.checked }))}
                      />
                      {c.h}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {prontas.length > 0 && (
              <>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="badge badge-success">{validas.length} prontos para importar</span>
                  {invalidas > 0 && <span className="badge badge-warn">{invalidas} serão ignorados (sem nome ou telefone inválido)</span>}
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                  <table className="table-clean">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Telefone</th>
                        <th>E-mail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prontas.slice(0, 6).map((p, i) => {
                        const ok = p.nome && normalizarTelefone(p.telefone);
                        return (
                          <tr key={i} className={ok ? "" : "opacity-50"}>
                            <td>{p.nome || "—"}</td>
                            <td>{normalizarTelefone(p.telefone) ?? <span className="text-coral">{p.telefone || "—"} (inválido)</span>}</td>
                            <td>{p.email || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="card px-5 py-5">
            <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-purple">Passo 3</p>
            <h2 className="mb-2 flex items-center gap-2 text-[16px] font-extrabold">
              <ShieldCheck size={18} className="text-teal" /> Autorização para enviar mensagens
            </h2>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-bg px-4 py-3.5">
              <input type="checkbox" className="toggle mt-0.5" checked={autorizado} onChange={(e) => setAutorizado(e.target.checked)} />
              <span className="text-[13px] leading-snug">
                <strong>Declaro que estes clientes autorizaram receber mensagens do meu negócio por WhatsApp.</strong>
                <span className="mt-1 block text-[12px] text-ink-soft">
                  Se você não marcar, os clientes entram na base normalmente, mas ficam <strong>fora</strong> de campanhas e mensagens automáticas até autorizarem. Isso protege o seu número contra bloqueios e cumpre a LGPD.
                </span>
              </span>
            </label>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={importar} disabled={!podeImportar} className={`btn btn-primary btn-lg ${pendente ? "btn-loading" : ""}`}>
                Importar {validas.length} {validas.length === 1 ? "cliente" : "clientes"}
              </button>
              {validas.length > 2000 && <span className="text-[12.5px] font-semibold text-coral">Passou de 2.000. Divida o arquivo em partes.</span>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

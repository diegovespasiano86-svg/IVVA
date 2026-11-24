"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LIMITE_ARQUIVO_MB, PASTAS, PASTA_LABEL, dataBR, nomeSeguro, reais, type ArquivoEstudio, type PedidoEstudio } from "@/lib/estudio-ops";
import { apagarArquivo, liberarPedido, moverPedido, registrarArquivo, salvarPedido } from "./actions";

const ORIGEM: Record<string, { l: string; c: string }> = {
  app: { l: "app", c: "bg-teal/10 text-teal" },
  landing_publica: { l: "landing", c: "bg-purple/10 text-purple" },
  campanha: { l: "campanha", c: "bg-amber-100 text-amber-800" },
  chat: { l: "chat", c: "bg-amber-100 text-amber-800" },
};

function prazo(p: PedidoEstudio) {
  if (!p.prazo_em || ["entregue", "conversa", "proposta", "fechado", "perdido"].includes(p.etapa)) return null;
  const h = (new Date(p.prazo_em).getTime() - Date.now()) / 3600000;
  if (h < 0) return { t: "prazo vencido", c: "text-coral" };
  if (h < 24) return { t: "vence hoje", c: "text-coral" };
  if (h < 48) return { t: "vence amanhã", c: "text-amber-700" };
  return { t: `prazo ${new Date(p.prazo_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, c: "text-teal" };
}

function wa(tel: string | null) {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? "55" + d : d}`;
}

function csv(pedidos: PedidoEstudio[]) {
  const cols: [string, (p: PedidoEstudio) => string | number][] = [
    ["Data", (p) => dataBR(p.criado_em)],
    ["Tipo", (p) => p.tipo],
    ["Etapa", (p) => p.etapa],
    ["Origem", (p) => p.origem],
    ["Nome", (p) => p.nome ?? ""],
    ["Negócio", (p) => p.negocio ?? ""],
    ["Plano", (p) => p.plano ?? "não cliente"],
    ["WhatsApp", (p) => p.telefone ?? ""],
    ["E-mail", (p) => p.email ?? ""],
    ["Instagram", (p) => p.instagram ?? ""],
    ["Concorrentes", (p) => p.concorrentes ?? ""],
    ["Período", (p) => p.periodo ?? ""],
    ["Objetivo", (p) => p.objetivo ?? ""],
    ["Prazo", (p) => dataBR(p.prazo_em)],
    ["Entregue em", (p) => dataBR(p.entregue_em)],
    ["Aberturas do relatório", (p) => p.aberto_vezes],
    ["Custo (R$)", (p) => (p.custo_centavos == null ? "" : (p.custo_centavos / 100).toFixed(2).replace(".", ","))],
    ["Proposta (R$)", (p) => (p.valor_proposta_centavos == null ? "" : (p.valor_proposta_centavos / 100).toFixed(2).replace(".", ","))],
    ["Notas", (p) => p.notas ?? ""],
  ];
  const cel = (v: string | number) => {
    const t = String(v ?? "");
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const linhas = [cols.map((c) => c[0]).join(";"), ...pedidos.map((p) => cols.map(([, f]) => cel(f(p))).join(";"))];
  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `estudio-pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function PainelEstudio({ pedidos, arquivos, etapas }: { pedidos: PedidoEstudio[]; arquivos: ArquivoEstudio[]; etapas: { id: string; label: string }[] }) {
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [verPerdidos, setVerPerdidos] = useState(false);
  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return b ? pedidos.filter((p) => [p.nome, p.negocio, p.email, p.telefone, p.instagram].some((x) => (x ?? "").toLowerCase().includes(b))) : pedidos;
  }, [busca, pedidos]);
  const aberto = pedidos.find((p) => p.id === abertoId) ?? null;
  const colunas = etapas.filter((e) => verPerdidos || e.id !== "perdido");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-[14px] font-bold">Pedidos por etapa</p>
        <input className="input w-56" placeholder="Buscar nome, negócio, @…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar pedidos" />
        <button type="button" onClick={() => setVerPerdidos(!verPerdidos)} className="rounded-full border border-border px-3.5 py-1.5 text-[12px] font-bold text-ink-soft hover:bg-surface-soft">
          {verPerdidos ? "Esconder perdidos" : "Ver perdidos"}
        </button>
        <button type="button" onClick={() => csv(filtrados)} disabled={!filtrados.length} className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">
          Baixar para o Excel
        </button>
      </div>

      <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-3">
        {colunas.map((col) => {
          const itens = filtrados.filter((p) => p.etapa === col.id);
          return (
            <div key={col.id} className="min-w-[220px] rounded-2xl bg-surface-soft p-2.5">
              <p className="mb-2 flex justify-between px-1 text-[11.5px] font-extrabold uppercase tracking-wide text-ink-faint">
                {col.label} <span className="tabular-nums">{itens.length}</span>
              </p>
              <div className="space-y-2">
                {itens.map((p) => {
                  const pz = prazo(p);
                  const o = ORIGEM[p.origem] ?? { l: p.origem, c: "bg-surface-soft text-ink-soft" };
                  const nArq = arquivos.filter((a) => a.pedido_id === p.id).length;
                  return (
                    <button key={p.id} type="button" onClick={() => setAbertoId(p.id)} className="card block w-full px-3 py-2.5 text-left transition hover:-translate-y-1 hover:shadow-lg">
                      <p className="truncate text-[13px] font-extrabold">{p.negocio || p.nome || "Sem nome"}</p>
                      <p className="truncate text-[11.5px] text-ink-soft">
                        {p.tipo === "diagnostico" ? "Diagnóstico" : "Conversa"} · {p.plano ?? "não cliente"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${o.c}`}>{o.l}</span>
                        {nArq > 0 && <span className="text-[10.5px] text-ink-faint">{nArq} arq.</span>}
                        {p.aberto_vezes > 0 && <span className="text-[10.5px] text-ink-faint">abriu {p.aberto_vezes}x</span>}
                      </div>
                      <p className={`mt-1 text-[11px] font-bold ${pz?.c ?? "text-ink-faint"}`}>{pz?.t ?? dataBR(p.criado_em)}</p>
                    </button>
                  );
                })}
                {itens.length === 0 && <p className="px-1 py-2 text-[11.5px] text-ink-faint">Nenhum</p>}
              </div>
            </div>
          );
        })}
      </div>

      {aberto && <Detalhe p={aberto} arquivos={arquivos.filter((a) => a.pedido_id === aberto.id)} etapas={etapas} fechar={() => setAbertoId(null)} />}
    </div>
  );
}

function Detalhe({ p, arquivos, etapas, fechar }: { p: PedidoEstudio; arquivos: ArquivoEstudio[]; etapas: { id: string; label: string }[]; fechar: () => void }) {
  const router = useRouter();
  const [pend, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [pasta, setPasta] = useState("relatorio");
  const [subindo, setSubindo] = useState(false);
  const link = wa(p.telefone);
  const idx = etapas.findIndex((e) => e.id === p.etapa);
  const proxima = etapas[idx + 1] && etapas[idx + 1].id !== "perdido" ? etapas[idx + 1] : null;

  async function subir(files: FileList | null) {
    if (!files?.length || !p.tenant_id) return;
    setSubindo(true);
    setMsg("");
    const sb = createClient();
    for (const f of Array.from(files)) {
      if (f.size > LIMITE_ARQUIVO_MB * 1048576) {
        setMsg(`"${f.name}" passa de ${LIMITE_ARQUIVO_MB} MB.`);
        continue;
      }
      const path = `${p.tenant_id}/${p.id}/${pasta}/${Date.now()}-${nomeSeguro(f.name)}`;
      const up = await sb.storage.from("estudio").upload(path, f, { contentType: f.type || undefined });
      if (up.error) {
        setMsg(`Falhou ao subir "${f.name}": ${up.error.message}`);
        continue;
      }
      const r = await registrarArquivo({ pedidoId: p.id, tenantId: p.tenant_id, pasta, nome: f.name, path, tamanho: f.size });
      if (!r.ok) setMsg(r.erro ?? "Falhou ao registrar.");
    }
    setSubindo(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={fechar}>
      <aside className="h-full w-full max-w-[560px] overflow-y-auto bg-surface px-5 py-5 shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label="Detalhe do pedido">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[18px] font-extrabold">{p.negocio || p.nome || "Sem nome"}</p>
            <p className="text-[12.5px] text-ink-soft">
              {p.tipo === "diagnostico" ? "Diagnóstico" : "Conversa"} · {p.plano ?? "não cliente"} · {dataBR(p.criado_em)}
            </p>
          </div>
          <button type="button" onClick={fechar} className="rounded-full border border-border px-3 py-1 text-[12px] font-bold">Fechar</button>
        </div>

        <div className="mb-4 grid gap-1.5 rounded-xl bg-surface-soft px-4 py-3 text-[13px]">
          <p><b>Nome:</b> {p.nome ?? "-"}</p>
          <p>
            <b>WhatsApp:</b> {p.telefone ?? "-"}{" "}
            {link && (
              <a href={link} target="_blank" rel="noopener" className="ml-1 font-bold text-teal underline">
                abrir conversa
              </a>
            )}
          </p>
          <p><b>E-mail:</b> {p.email ?? "-"}</p>
          <p><b>Instagram:</b> {p.instagram ?? "-"}</p>
          <p><b>Concorrentes:</b> {p.concorrentes ?? "-"}</p>
          {p.objetivo && <p><b>Objetivo:</b> {p.objetivo}</p>}
          {p.formatos && <p><b>Formatos:</b> {p.formatos}</p>}
          <p><b>Melhor período:</b> {p.periodo ?? "-"}</p>
          {Object.entries(p.respostas ?? {}).map(([k, v]) => (
            <p key={k}>
              <b>{k}:</b> {v}
            </p>
          ))}
          <p className="text-ink-faint">Origem: {p.origem} · relatório aberto {p.aberto_vezes}x</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {proxima && (
            <button type="button" disabled={pend} onClick={() => start(async () => { await moverPedido(p.id, proxima.id); router.refresh(); })} className="btn btn-secondary btn-md">
              Mover para {proxima.label} →
            </button>
          )}
          {p.tipo === "diagnostico" && !p.entregue_em && (
            <button
              type="button"
              disabled={pend}
              onClick={() =>
                start(async () => {
                  const r = await liberarPedido(p.id);
                  setMsg(r.ok ? (r.avisado ? "Liberado. O cliente recebeu o e-mail." : "Liberado. Sem e-mail do cliente: avise pelo WhatsApp.") : (r.erro ?? "Falhou."));
                  router.refresh();
                })
              }
              className="btn btn-primary btn-md"
            >
              Liberar relatório ao cliente
            </button>
          )}
        </div>

        <form
          className="mb-5 grid gap-3"
          action={(fd) =>
            start(async () => {
              const r = await salvarPedido(fd);
              setMsg(r.ok ? "Salvo." : (r.erro ?? "Falhou."));
              router.refresh();
            })
          }
        >
          <input type="hidden" name="id" value={p.id} />
          <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">
            Etapa
            <select name="etapa" defaultValue={p.etapa} className="input mt-1 w-full">
              {etapas.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">
              Custo (R$)
              <input name="custo" defaultValue={p.custo_centavos == null ? "" : (p.custo_centavos / 100).toFixed(2).replace(".", ",")} className="input mt-1 w-full" placeholder="19,00" />
            </label>
            <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">
              Proposta (R$)
              <input name="valor" defaultValue={p.valor_proposta_centavos == null ? "" : (p.valor_proposta_centavos / 100).toFixed(2).replace(".", ",")} className="input mt-1 w-full" placeholder="3.200,00" />
            </label>
          </div>
          <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">
            Anotações
            <textarea name="notas" defaultValue={p.notas ?? ""} rows={3} className="input mt-1 w-full" />
          </label>
          <button className="btn btn-primary btn-md justify-self-start" disabled={pend}>Salvar</button>
        </form>

        <div className="mb-2 flex items-center justify-between">
          <p className="text-[14px] font-bold">Arquivos do pedido</p>
          <span className="text-[12px] text-ink-faint">Custo e proposta: {reais(p.custo_centavos)} · {reais(p.valor_proposta_centavos)}</span>
        </div>
        {p.tenant_id ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select value={pasta} onChange={(e) => setPasta(e.target.value)} className="input w-auto" aria-label="Pasta do arquivo">
              {PASTAS.filter((x) => x.id !== "enviados").map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
            <input id={`up-${p.id}`} type="file" multiple className="hidden" onChange={(e) => subir(e.target.files)} />
            <label htmlFor={`up-${p.id}`} className={`btn btn-secondary btn-md cursor-pointer ${subindo ? "pointer-events-none opacity-60" : ""}`}>
              {subindo ? "Enviando…" : "Anexar arquivo"}
            </label>
          </div>
        ) : (
          <p className="mb-3 rounded-xl bg-surface-soft px-3 py-2 text-[12.5px] text-ink-soft">Pedido da landing pública: a pessoa ainda não tem conta na ivva, então os arquivos vão por WhatsApp ou e-mail.</p>
        )}
        <ul className="space-y-1.5">
          {arquivos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-soft px-3 py-2 text-[12.5px]">
              <span className="min-w-0 truncate">
                <b>{PASTA_LABEL[a.pasta]}</b> · {a.nome} {a.enviado_por === "cliente" && <span className="text-purple">(cliente)</span>}
              </span>
              <button type="button" onClick={() => start(async () => { await apagarArquivo(a.id); router.refresh(); })} className="shrink-0 text-[11.5px] font-bold text-coral">
                apagar
              </button>
            </li>
          ))}
          {arquivos.length === 0 && <li className="text-[12.5px] text-ink-faint">Nenhum arquivo ainda.</li>}
        </ul>
        {msg && <p className="mt-3 text-[13px] font-semibold text-purple">{msg}</p>}
      </aside>
    </div>
  );
}

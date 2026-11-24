"use client";

import { useState } from "react";
import Link from "next/link";
import { FORMATOS } from "@/lib/estudio-dados";

const PERIODOS = ["Manhã", "Tarde", "Noite"];

/** Pedido do Estúdio feito de dentro do app. Vai para /api/estudio/pedido, que identifica o negócio pela sessão. */
export default function ProjetoForm({ temCredito, jaUsou }: { temCredito: boolean; jaUsou: boolean }) {
  const [instagram, setInstagram] = useState("");
  const [conc, setConc] = useState(["", "", ""]);
  const [formatos, setFormatos] = useState<string[]>(["Reels"]);
  const [objetivo, setObjetivo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<null | { tipo: string; ja_usado: boolean }>(null);

  const diagnostico = temCredito && !jaUsou;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!instagram.trim()) return setErro("Informe o seu Instagram.");
    if (telefone.replace(/\D/g, "").length < 10) return setErro("Informe o WhatsApp com DDD para avisarmos você.");
    setEnviando(true);
    try {
      const r = await fetch("/api/estudio/pedido", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          instagram,
          concorrentes: conc.filter((c) => c.trim()).join(", "),
          formatos: formatos.join(", "),
          objetivo,
          telefone,
          periodo,
          respostas: { Origem: "Faça seu projeto" },
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.erro || "Não conseguimos enviar.");
      setFeito({ tipo: j.tipo, ja_usado: j.ja_usado });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não conseguimos enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (feito) {
    const diag = feito.tipo === "diagnostico";
    return (
      <div className="card px-5 py-5">
        <p className="text-[16px] font-extrabold">{diag ? "Pedido de diagnóstico recebido" : "Pedido recebido"}</p>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          {diag
            ? "O time já está com o seu pedido. Em até 3 dias úteis o relatório fica pronto em Meus relatórios e avisamos você no WhatsApp."
            : feito.ja_usado
              ? "O diagnóstico deste ciclo já foi usado, então registramos como pedido de conversa. O Diego chama você no WhatsApp para combinar."
              : "O Diego chama você no WhatsApp para combinar a conversa de 25 minutos e montar a proposta."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/estudio/relatorios" className="btn btn-primary btn-md">Acompanhar em Meus relatórios</Link>
        </div>
      </div>
    );
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition hover:-translate-y-0.5 ${on ? "border-purple bg-purple/10 text-purple" : "border-border text-ink-soft"}`;

  return (
    <form className="card space-y-4 px-5 py-5" onSubmit={enviar}>
      <div className={`rounded-xl px-4 py-3 text-[13px] ${diagnostico ? "bg-teal/10 text-teal" : "bg-surface-soft text-ink-soft"}`}>
        {diagnostico
          ? "Seu plano inclui 1 diagnóstico por ciclo e ele está disponível. Este pedido usa o diagnóstico."
          : jaUsou
            ? "Você já usou o diagnóstico deste ciclo. Este pedido vira uma conversa com o time para montar a proposta."
            : "Seu plano ainda não inclui o diagnóstico. Este pedido vira uma conversa com o time para montar a proposta."}
      </div>
      <div>
        <label htmlFor="ig" className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Seu perfil no Instagram</label>
        <input id="ig" className="input mt-1 w-full" placeholder="@seunegocio" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
      </div>
      <div>
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Até 3 concorrentes (opcional)</p>
        {conc.map((u, i) => (
          <input key={i} aria-label={`Concorrente ${i + 1}`} className="input mt-1 w-full" placeholder={`@ ou link do concorrente ${i + 1}`} value={u} onChange={(e) => setConc(conc.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
      </div>
      <div>
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">O que você quer produzir</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {FORMATOS.map((f) => {
            const on = formatos.includes(f);
            return (
              <button type="button" key={f} onClick={() => setFormatos(on ? formatos.filter((x) => x !== f) : [...formatos, f])} className={chip(on)}>
                {f}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label htmlFor="obj" className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Objetivo</label>
        <textarea id="obj" className="input mt-1 w-full" rows={3} placeholder="Ex.: encher a agenda de terça a quinta, vender o pacote X..." value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tel" className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">WhatsApp para avisarmos você</label>
          <input id="tel" type="tel" className="input mt-1 w-full" placeholder="(11) 90000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </div>
        <div>
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Melhor período para a conversa</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PERIODOS.map((p) => (
              <button type="button" key={p} onClick={() => setPeriodo(p)} className={chip(periodo === p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      {erro && <p className="text-[13px] font-semibold text-coral">{erro}</p>}
      <button className="btn btn-primary btn-md" disabled={enviando}>
        {enviando ? "Enviando…" : diagnostico ? "Pedir meu diagnóstico" : "Enviar pedido"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { FORMATOS } from "@/lib/estudio";

export default function ProjetoForm({ bloqueado }: { bloqueado: boolean }) {
  const [urls, setUrls] = useState(["", "", ""]);
  const [formatos, setFormatos] = useState<string[]>(["Reels"]);
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <div className="card px-5 py-5">
        <p className="text-[15px] font-extrabold">Pedido simulado com sucesso</p>
        <p className="mt-1 text-[13px] text-ink-soft">Nesta prévia nada foi enviado nem gerado. Na versão final, o diagnóstico fica pronto em Meus relatórios.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/estudio/relatorios" className="btn btn-primary btn-md">Ver relatório de exemplo</Link>
          <button className="btn btn-secondary btn-md" onClick={() => setEnviado(false)}>Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="card space-y-4 px-5 py-5"
      onSubmit={(e) => {
        e.preventDefault();
        setEnviado(true);
      }}
    >
      <fieldset disabled={bloqueado} className="space-y-4 disabled:opacity-50">
        <div>
          <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Seu perfil no Instagram</label>
          <input className="input mt-1 w-full" placeholder="@seunegocio" required />
        </div>
        <div>
          <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Até 3 concorrentes (opcional)</label>
          {urls.map((u, i) => (
            <input key={i} className="input mt-1 w-full" placeholder={`Link ou @ do concorrente ${i + 1}`} value={u} onChange={(e) => setUrls(urls.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
        </div>
        <div>
          <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">O que você quer produzir</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {FORMATOS.map((f) => {
              const on = formatos.includes(f);
              return (
                <button type="button" key={f} onClick={() => setFormatos(on ? formatos.filter((x) => x !== f) : [...formatos, f])} className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${on ? "border-purple bg-purple/10 text-purple" : "border-line text-ink-soft"}`}>
                  {f}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Logo da marca (opcional)</label>
          <input type="file" accept="image/*" className="mt-1 block text-[13px]" />
        </div>
        <div>
          <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Objetivo</label>
          <textarea className="input mt-1 w-full" rows={3} placeholder="Ex.: encher a agenda de terça a quinta, vender o pacote X..." />
        </div>
      </fieldset>
      <button className="btn btn-primary btn-md" disabled={bloqueado}>Gerar meu diagnóstico</button>
      <p className="text-[12px] text-ink-faint">Prévia: o envio é simulado e não consome seu crédito.</p>
    </form>
  );
}

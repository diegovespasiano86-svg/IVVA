"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, PlayCircle, X } from "lucide-react";

const CHAVE = "ivva:boas-vindas-modal";

type Passo = { titulo: string; texto: string; href: string; feito: boolean };

/** Popup de orientação do primeiro acesso: mostra o caminho curto e leva direto para o primeiro passo da configuração. */
export default function BoasVindasModal({ nome, passos }: { nome?: string; passos: Passo[] }) {
  const [aberto, setAberto] = useState(false);

  // Conectar o WhatsApp vai por último: depende de a conta estar pronta e o robô já ensinado.
  const ordenados = [...passos].sort((a, b) => Number(a.href === "/canais") - Number(b.href === "/canais"));
  const pendentes = ordenados.filter((p) => !p.feito);
  const primeiro = pendentes[0];

  useEffect(() => {
    if (!primeiro) return;
    const id = window.setTimeout(() => {
      try {
        if (localStorage.getItem(CHAVE) !== "1") setAberto(true);
      } catch {
        setAberto(true);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [primeiro]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  function fechar() {
    setAberto(false);
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {}
  }

  if (!aberto || !primeiro) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Boas-vindas à ivva">
      <button className="absolute inset-0 bg-ink-deep/70" aria-label="Fechar" onClick={fechar} />
      <div className="card relative w-full max-w-[520px] px-6 py-6">
        <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-3 top-3 rounded-full p-1.5 text-ink-soft hover:bg-surface-soft">
          <X size={16} />
        </button>
        <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Bem-vindo à ivva</p>
        <h2 className="mt-1 text-[22px] font-extrabold leading-tight">
          {nome ? `${nome}, vamos` : "Vamos"} deixar o seu robô pronto
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-snug text-ink-soft">
          São poucos passos, na ordem abaixo. Cada um tem um vídeo curto, e o botão “Próximo passo” te acompanha em todas as telas.
        </p>

        <ol className="mt-4 flex flex-col gap-2">
          {ordenados.map((p, i) => (
            <li key={p.href} className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 ${p === primeiro ? "border-purple bg-purple/5" : "border-border"}`}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${p.feito ? "bg-[#0a7f69] text-white" : "bg-surface-soft text-ink-soft"}`}>
                {p.feito ? <Check size={12} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-bold">{p.titulo}</span>
                <span className="block text-[12px] leading-snug text-ink-soft">{p.texto}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={primeiro.href} onClick={fechar} className="btn btn-primary btn-md">
            Começar a configuração <ArrowRight size={15} className="btn-arrow" />
          </Link>
          <Link href="/ajuda" onClick={fechar} className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-purple hover:underline">
            <PlayCircle size={15} /> Ver os vídeos
          </Link>
          <button type="button" onClick={fechar} className="ml-auto text-[12.5px] font-semibold text-ink-faint hover:text-ink">
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

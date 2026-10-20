"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

const CHAVE = "ivva-proximo-passo-fechado";

// Botão flutuante "Próximo passo": lembra o dono do que falta para o robô atender, em qualquer tela.
// Some no Início (onde o checklist completo já aparece) e pode ser dispensado por hoje.
export default function ProximoPassoFlutuante({
  titulo,
  href,
  feitos,
  total,
}: {
  titulo: string;
  href: string;
  feitos: number;
  total: number;
}) {
  const pathname = usePathname();
  const [fechado, setFechado] = useState(true);

  useEffect(() => {
    try {
      const hoje = new Date().toDateString();
      setFechado(localStorage.getItem(CHAVE) === hoje);
    } catch {
      setFechado(false);
    }
  }, []);

  if (fechado || pathname === "/dashboard" || pathname.startsWith("/ajuda") || pathname === href) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-border bg-surface py-2 pl-4 pr-2 shadow-[0_10px_30px_-10px_rgba(20,19,27,0.35)]">
      <Link href={href} className="flex items-center gap-2 text-[12.5px] font-bold">
        <span className="rounded-full bg-purple px-2 py-0.5 text-[11px] text-white">{feitos}/{total}</span>
        <span className="truncate">Próximo passo: {titulo}</span>
        <ArrowRight size={14} className="shrink-0 text-purple" aria-hidden="true" />
      </Link>
      <button
        type="button"
        aria-label="Dispensar por hoje"
        onClick={() => {
          setFechado(true);
          try {
            localStorage.setItem(CHAVE, new Date().toDateString());
          } catch {}
        }}
        className="rounded-full p-1.5 text-ink-faint hover:bg-surface-soft"
      >
        <X size={14} />
      </button>
    </div>
  );
}

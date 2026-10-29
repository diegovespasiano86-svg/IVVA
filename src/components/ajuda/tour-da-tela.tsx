"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PlayCircle, X } from "lucide-react";
import { GUIAS } from "@/lib/guias";
import { guiaDaRota } from "@/lib/ajuda-busca";

const PREFIXO = "ivva-tour-";

/**
 * Balão de boas-vindas na 1ª visita a cada pasta: mostra os 3 passos do guia da tela e leva ao vídeo.
 * Aparece uma vez por tela (por navegador). Não aparece no Início (já tem o vídeo de boas-vindas) nem na Ajuda.
 */
export default function TourDaTela() {
  const pathname = usePathname();
  const [visivel, setVisivel] = useState<string | null>(null);

  useEffect(() => {
    // Fecha o balão ao trocar de tela e decide, no navegador, se esta tela ainda não foi vista.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê localStorage só no navegador
    setVisivel(null);
    if (pathname === "/dashboard" || pathname.startsWith("/ajuda")) return;
    const guia = guiaDaRota(pathname, GUIAS);
    if (!guia || guia.passos.length === 0) return;
    try {
      if (localStorage.getItem(PREFIXO + guia.id) === "1") return;
    } catch {
      return;
    }
    const t = setTimeout(() => setVisivel(guia.id), 900);
    return () => clearTimeout(t);
  }, [pathname]);

  const guia = visivel ? GUIAS.find((g) => g.id === visivel) : null;
  if (!guia) return null;

  const fechar = () => {
    try {
      localStorage.setItem(PREFIXO + guia.id, "1");
    } catch {}
    setVisivel(null);
  };

  return (
    <div
      role="dialog"
      aria-label={`Guia rápido: ${guia.titulo}`}
      className="fixed right-4 top-20 z-40 w-[min(340px,calc(100vw-2rem))] rounded-[16px] border border-purple/35 bg-surface p-4 shadow-[0_18px_40px_-14px_rgba(20,19,27,0.4)]"
    >
      <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-2.5 top-2.5 rounded-full p-1 text-ink-faint hover:bg-surface-soft">
        <X size={14} />
      </button>
      <p className="text-[11px] font-bold uppercase tracking-wide text-purple">Primeira vez aqui?</p>
      <p className="mt-0.5 pr-5 text-[14px] font-extrabold">{guia.titulo}</p>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-[12.5px] text-ink-soft">
        {guia.passos.slice(0, 3).map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={fechar} className="btn btn-primary btn-sm">
          Entendi
        </button>
        {guia.video && (
          <Link href={`/ajuda?abrir=${guia.id}`} onClick={fechar} className="btn btn-ghost btn-sm inline-flex items-center gap-1">
            <PlayCircle size={14} /> Ver o vídeo
          </Link>
        )}
      </div>
    </div>
  );
}

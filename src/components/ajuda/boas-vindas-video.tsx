"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlayCircle, X } from "lucide-react";

const CHAVE = "ivva:boas-vindas-video";

/** Vídeo de abertura no painel do dono: aparece até ser dispensado (ou assistido). */
export default function BoasVindasVideo({ forcar }: { forcar?: boolean }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      setVisivel(forcar || localStorage.getItem(CHAVE) !== "1");
    } catch {
      setVisivel(true);
    }
  }, [forcar]);

  function dispensar() {
    setVisivel(false);
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {}
  }

  if (!visivel) return null;

  return (
    <section className="card mb-6 overflow-hidden" aria-label="Vídeo de boas-vindas">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <video src="/ajuda/inicio.mp4" poster="/ajuda/inicio.jpg" controls playsInline preload="none" onEnded={dispensar} className="aspect-video w-full bg-black" />
        <div className="relative flex flex-col justify-center gap-2 px-5 py-5">
          <button type="button" onClick={dispensar} aria-label="Dispensar vídeo" className="absolute right-3 top-3 rounded-full p-1.5 text-ink-soft hover:bg-surface-soft">
            <X size={16} />
          </button>
          <p className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-purple">
            <PlayCircle size={14} /> Comece por aqui
          </p>
          <h2 className="text-[18px] font-extrabold leading-tight">Conheça a ivva em menos de 1 minuto</h2>
          <p className="text-[13px] leading-snug text-ink-soft">
            Veja como ler o seu painel e o que fazer primeiro. Cada passo do checklist abaixo tem um vídeo curto.
          </p>
          <Link href="/ajuda" className="mt-1 text-[12.5px] font-bold text-purple hover:underline">
            Ver todos os vídeos em Aprender
          </Link>
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlayCircle, Search } from "lucide-react";
import type { Guia } from "@/lib/guias";
import { buscarGuias } from "@/lib/ajuda-busca";
import VideoModal from "./video-modal";

/** Central de ajuda: busca por palavra, vídeos passo a passo e o guia escrito de cada tela. */
export default function CentralAjuda({ guias, busca, abrir }: { guias: Guia[]; busca?: string; abrir?: string }) {
  const [q, setQ] = useState(busca ?? "");
  const [tocando, setTocando] = useState<Guia | null>(null);
  const resultado = useMemo(() => buscarGuias(q, guias), [q, guias]);
  const comVideo = resultado.filter((g) => g.video);
  const buscando = q.trim().length > 0;

  return (
    <div>
      <label className="relative mb-5 block">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="O que você quer fazer? Ex.: conectar WhatsApp, estoque, Pix, senha"
          aria-label="Buscar nos guias e vídeos"
          className="input h-12 !pl-11 text-[14.5px]"
        />
      </label>

      {comVideo.length > 0 && (
        <section className="mb-6" aria-label="Vídeos passo a passo">
          <h2 className="mb-2.5 text-[15px] font-extrabold">{buscando ? "Vídeos" : "Vídeos passo a passo"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comVideo.map((g) => (
              <button key={g.id} type="button" onClick={() => setTocando(g)} className="card group overflow-hidden text-left transition-shadow hover:shadow-lg">
                <span className="relative block aspect-video bg-ink-deep">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {g.poster && <img src={g.poster} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
                    <PlayCircle size={44} strokeWidth={1.5} className="text-white drop-shadow" />
                  </span>
                  {g.duracao && <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white">{g.duracao}</span>}
                </span>
                <span className="block px-3.5 py-3">
                  <span className="block text-[13.5px] font-extrabold">{g.titulo}</span>
                  <span className="block text-[12px] leading-snug text-ink-soft">{g.resumo}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Guias por tela">
        <h2 className="mb-2.5 text-[15px] font-extrabold">{buscando ? "Guias" : "Guia escrito de cada tela"}</h2>
        {resultado.length === 0 && (
          <p className="card px-5 py-6 text-center text-[13.5px] text-ink-soft">
            Nada encontrado para “{q}”. Tente outra palavra ou pergunte à Vi no botão Pergunte a Ivva, no canto da tela.
          </p>
        )}
        <div className="space-y-2.5">
          {resultado.map((g) => (
            <details key={g.id} id={g.id} open={abrir === g.id || (buscando && resultado.length <= 3)} className="card group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <span className="block text-[14.5px] font-extrabold">{g.titulo}</span>
                  <span className="block text-[12.5px] text-ink-soft">{g.resumo}</span>
                </span>
                <span aria-hidden="true" className="text-[18px] text-ink-faint transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1fr]">
                <ol className="list-decimal space-y-2 pl-5 text-[13px] text-ink-soft">
                  {g.passos.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
                {g.video ? (
                  <button type="button" onClick={() => setTocando(g)} className="relative block aspect-video overflow-hidden rounded-xl bg-ink-deep" aria-label={`Assistir: ${g.titulo}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {g.poster && <img src={g.poster} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <PlayCircle size={40} strokeWidth={1.5} className="text-white" />
                    </span>
                  </button>
                ) : (
                  <div className="flex min-h-[110px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface-soft text-ink-faint">
                    <PlayCircle size={22} strokeWidth={1.6} />
                    <span className="text-[12px] font-semibold">Vídeo em breve</span>
                  </div>
                )}
              </div>
              <Link href={g.href} className="btn btn-secondary btn-sm mt-4">
                Abrir {g.titulo}
              </Link>
            </details>
          ))}
        </div>
      </section>

      {tocando?.video && <VideoModal titulo={tocando.titulo} src={tocando.video} poster={tocando.poster} onClose={() => setTocando(null)} />}
    </div>
  );
}

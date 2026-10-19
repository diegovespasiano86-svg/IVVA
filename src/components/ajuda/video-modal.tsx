"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Player sobre a página; Esc ou clique fora fecham. */
export default function VideoModal({ titulo, src, poster, onClose }: { titulo: string; src: string; poster?: string; onClose: () => void }) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <button className="absolute inset-0 bg-ink-deep/70" aria-label="Fechar vídeo" onClick={onClose} />
      <div className="relative w-full max-w-[960px]">
        <div className="mb-2 flex items-center justify-between text-white">
          <p className="text-[14px] font-extrabold">{titulo}</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full bg-white/10 p-1.5 hover:bg-white/20">
            <X size={18} />
          </button>
        </div>
        <video src={src} poster={poster} controls autoPlay playsInline className="w-full rounded-2xl bg-black shadow-2xl" />
      </div>
    </div>
  );
}

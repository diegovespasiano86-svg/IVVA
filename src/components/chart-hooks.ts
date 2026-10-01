"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mede a largura real do contêiner (ResizeObserver) para desenhar o SVG em
 * pixels de verdade: texto nunca estica e a dica acompanha o mouse com precisão.
 * Antes de medir (servidor/1º render) usa `inicial`, então a hidratação bate.
 */
export function useLargura<T extends HTMLElement>(inicial = 640) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entradas) => {
      const w = Math.round(entradas[0]?.contentRect.width ?? 0);
      if (w > 0) setLargura(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

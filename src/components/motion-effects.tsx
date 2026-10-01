"use client";

import { useEffect } from "react";

/**
 * Efeito magnético dos botões de destaque (igual ao site): o botão acompanha
 * levemente o mouse. Um único ouvinte para o app inteiro. Desligado em
 * telas de toque e para quem pediu menos movimento.
 */
export default function MotionEffects() {
  useEffect(() => {
    const fino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fino || reduzido) return;

    let atual: HTMLElement | null = null;

    function soltar() {
      if (!atual) return;
      atual.style.setProperty("--mx", "0px");
      atual.style.setProperty("--my", "0px");
      atual = null;
    }

    function mover(e: PointerEvent) {
      const alvo = (e.target as HTMLElement | null)?.closest<HTMLElement>(".btn-primary, .btn-dark, .btn-danger");
      if (!alvo || alvo.hasAttribute("disabled")) {
        soltar();
        return;
      }
      if (atual && atual !== alvo) soltar();
      atual = alvo;
      const r = alvo.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) * 0.18;
      const dy = (e.clientY - r.top - r.height / 2) * 0.28;
      alvo.style.setProperty("--mx", `${Math.max(-7, Math.min(7, dx))}px`);
      alvo.style.setProperty("--my", `${Math.max(-5, Math.min(5, dy))}px`);
    }

    document.addEventListener("pointermove", mover, { passive: true });
    document.addEventListener("pointerleave", soltar);
    return () => {
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerleave", soltar);
      soltar();
    };
  }, []);

  return null;
}

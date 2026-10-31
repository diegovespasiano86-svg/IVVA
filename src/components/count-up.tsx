"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que sobe até o valor (1,2 s). Dentro de um cartão que está entrando (entrada-tela.tsx),
 * espera o cartão começar a aparecer. Sem animação para quem pediu menos movimento.
 */
export default function CountUp({ value, kind = "int" }: { value: number; kind?: "int" | "brl" }) {
  const [atual, setAtual] = useState(value);
  const ja = useRef(false);
  const no = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ja.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) return;
    let raf = 0;
    let mo: MutationObserver | undefined;
    let seguranca = 0;

    const contar = () => {
      if (ja.current) return;
      ja.current = true;
      mo?.disconnect();
      window.clearTimeout(seguranca);
      const t0 = performance.now();
      const passo = (t: number) => {
        const p = Math.min(1, (t - t0) / 1200);
        setAtual(value * (1 - Math.pow(1 - p, 4)));
        if (p < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    };

    const cartao = no.current?.closest<HTMLElement>(".tela-pre, .tela-rise");
    if (!cartao || cartao.classList.contains("tela-go")) contar();
    else {
      mo = new MutationObserver(() => cartao.classList.contains("tela-go") && contar());
      mo.observe(cartao, { attributes: true, attributeFilter: ["class"] });
      seguranca = window.setTimeout(contar, 6000);
    }
    return () => {
      mo?.disconnect();
      window.clearTimeout(seguranca);
      cancelAnimationFrame(raf);
    };
  }, [value]);

  const texto =
    kind === "brl"
      ? atual.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
      : Math.round(atual).toLocaleString("pt-BR");
  return (
    <span ref={no} className="num">
      {texto}
    </span>
  );
}

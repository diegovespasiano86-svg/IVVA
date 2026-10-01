"use client";

import { useEffect, useRef, useState } from "react";

/** Número que sobe até o valor (600 ms). Sem animação para quem pediu menos movimento. */
export default function CountUp({ value, kind = "int" }: { value: number; kind?: "int" | "brl" }) {
  const [atual, setAtual] = useState(value);
  const ja = useRef(false);

  useEffect(() => {
    if (ja.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) return;
    ja.current = true;
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / 600);
      const e = 1 - Math.pow(1 - p, 4);
      setAtual(value * e);
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const texto =
    kind === "brl"
      ? atual.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
      : Math.round(atual).toLocaleString("pt-BR");
  return <span className="num">{texto}</span>;
}

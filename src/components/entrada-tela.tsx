"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Ao abrir uma tela, a faixa de boas-vindas e os cartões entram um a um quando aparecem na
 * janela: sobem, saem do desfoque e assentam, e só então os gráficos se desenham e os números
 * contam (os movimentos de dentro ficam pausados até o cartão começar a entrar; ver vidro.css).
 * Cartões abaixo da dobra esperam você chegar neles. Conteúdo que chega depois (carregamento em
 * etapas) também entra, por até 8 s após a troca de tela.
 */
export default function EntradaTela() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let n = 0;
    let zera = 0;
    const timers: number[] = [];
    const pendentes = new Set<HTMLElement>();
    const visto = new WeakSet<Element>();

    const revelar = (el: HTMLElement) => {
      if (!pendentes.delete(el)) return;
      io.unobserve(el);
      const i = Math.min(n++, 8);
      window.clearTimeout(zera);
      zera = window.setTimeout(() => (n = 0), 350);
      el.style.setProperty("--i", String(i));
      el.classList.remove("tela-pre");
      el.classList.add("tela-rise");
      timers.push(window.setTimeout(() => el.classList.add("tela-go"), i * 140 + 250));
    };

    const io = new IntersectionObserver(
      (lista) => {
        for (const e of lista) if (e.isIntersecting) revelar(e.target as HTMLElement);
      },
      { threshold: 0.08 },
    );

    const animar = (raiz: ParentNode) => {
      raiz.querySelectorAll<HTMLElement>(".page-hero, .card").forEach((el) => {
        if (visto.has(el) || el.parentElement?.closest(".card, .page-hero")) return;
        visto.add(el);
        el.classList.add("tela-pre");
        pendentes.add(el);
        io.observe(el);
      });
    };

    animar(main);
    const mo = new MutationObserver((lista) => {
      for (const r of lista) {
        r.addedNodes.forEach((nd) => {
          if (nd instanceof HTMLElement && (nd.matches(".page-hero, .card") || nd.querySelector(".page-hero, .card"))) {
            animar(nd.parentElement ?? main);
          }
        });
      }
    });
    mo.observe(main, { childList: true, subtree: true });
    timers.push(window.setTimeout(() => mo.disconnect(), 8000));
    // rede de segurança: nada fica escondido se o navegador não avisar (aba em segundo plano)
    timers.push(window.setTimeout(() => [...pendentes].forEach(revelar), 4000));

    return () => {
      mo.disconnect();
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(zera);
      pendentes.forEach((el) => el.classList.remove("tela-pre"));
    };
  }, [pathname]);

  return null;
}

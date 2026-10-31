"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Ao abrir uma tela, a faixa de boas-vindas e os cartões entram um atrás do outro
 * (sobem, saem do desfoque e assentam). O movimento em si fica em vidro.css (.tela-rise);
 * aqui só se marca quem entra e em que ordem. Conteúdo que chega depois (carregamento
 * em etapas) também entra, por até 1,5 s após a troca de tela.
 */
export default function EntradaTela() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let n = 0;
    const visto = new WeakSet<Element>();
    const animar = (raiz: ParentNode) => {
      raiz.querySelectorAll<HTMLElement>(".page-hero, .card").forEach((el) => {
        if (visto.has(el) || el.parentElement?.closest(".card, .page-hero")) return;
        visto.add(el);
        el.style.setProperty("--i", String(Math.min(n++, 9)));
        el.classList.add("tela-rise");
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
    const t = window.setTimeout(() => mo.disconnect(), 1500);
    return () => {
      mo.disconnect();
      window.clearTimeout(t);
    };
  }, [pathname]);

  return null;
}

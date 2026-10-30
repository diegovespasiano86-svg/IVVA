"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { CHAVE_TEMA, EVENTO_TEMA, aplicarTema, temaGuardado, type Tema } from "@/components/tema-app";

function assinar(cb: () => void) {
  window.addEventListener(EVENTO_TEMA, cb);
  return () => window.removeEventListener(EVENTO_TEMA, cb);
}
const lerTema = (): Tema => (document.documentElement.getAttribute("data-theme") === "dark" ? "escuro" : "claro");

/** Botão "Modo" do cabeçalho: Claro ou Escuro, lembrado neste navegador. */
export default function ModoTema() {
  const tema = useSyncExternalStore(assinar, lerTema, () => "claro" as Tema);
  // sem animação na primeira pintura: o botão já nasce no modo certo
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function escolher(t: Tema) {
    if (t === temaGuardado() && t === lerTema()) return;
    const html = document.documentElement;
    html.classList.add("tema-troca");
    try {
      localStorage.setItem(CHAVE_TEMA, t);
    } catch {
      /* sem armazenamento: vale só até recarregar */
    }
    aplicarTema(t);
    window.setTimeout(() => html.classList.remove("tema-troca"), 600);
  }

  return (
    <div className="modo-tema" role="group" aria-label="Modo de exibição">
      <span className="modo-tema-rotulo" aria-hidden="true">
        Modo
      </span>
      <div className={`modo-tema-chave${pronto ? " pronto" : ""}`} data-tema={tema}>
        <i aria-hidden="true" />
        <button type="button" aria-pressed={tema === "claro"} onClick={() => escolher("claro")} title="Modo claro">
          <Sun size={14} aria-hidden="true" />
          <span>Claro</span>
        </button>
        <button type="button" aria-pressed={tema === "escuro"} onClick={() => escolher("escuro")} title="Modo escuro">
          <Moon size={14} aria-hidden="true" />
          <span>Escuro</span>
        </button>
      </div>
    </div>
  );
}

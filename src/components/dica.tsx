import type { ReactNode } from "react";

/**
 * Dica ao passar o mouse (ou focar com o teclado) explicando para que serve um botão.
 * Só CSS: funciona em Server Components, não atrapalha clique nem arrastar.
 * A aparência (claro/escuro) vem da classe `.dica-balao` em globals.css e tema.css.
 * Mantenha o texto curto (uma frase): o balão é pequeno de propósito.
 * `lado="baixo"` abre a dica para baixo. `alinhar` escolhe de que lado do botão ela cresce:
 * "inicio" (para a direita), "fim" (para a esquerda) ou "centro".
 */
export function Dica({
  texto,
  children,
  lado = "cima",
  alinhar = "centro",
  className = "",
}: {
  texto: string;
  children: ReactNode;
  lado?: "cima" | "baixo";
  alinhar?: "inicio" | "centro" | "fim";
  className?: string;
}) {
  const horizontal =
    alinhar === "inicio" ? "left-0" : alinhar === "fim" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className={`group/dica relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`dica-balao pointer-events-none absolute z-50 w-max max-w-[210px] opacity-0 transition-opacity duration-150 group-hover/dica:opacity-100 group-focus-within/dica:opacity-100 ${horizontal} ${
          lado === "cima" ? "bottom-full mb-1.5" : "top-full mt-1.5"
        }`}
      >
        {texto}
      </span>
    </span>
  );
}

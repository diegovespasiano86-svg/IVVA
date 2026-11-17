import type { ReactNode } from "react";

/**
 * Dica ao passar o mouse (ou focar com o teclado) explicando para que serve um botão.
 * Só CSS: funciona em Server Components, não atrapalha clique nem arrastar.
 * `lado="baixo"` abre a dica para baixo (use perto do topo da tela ou de áreas com rolagem).
 * `alinhar` escolhe de que lado do botão a dica cresce: "inicio" (para a direita, bom para
 * itens à esquerda), "fim" (para a esquerda, bom para itens na borda direita) ou "centro".
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
        className={`pointer-events-none absolute z-50 w-max max-w-[230px] rounded-[9px] bg-ink-deep px-3 py-2 text-left text-[11.5px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/dica:opacity-100 group-focus-within/dica:opacity-100 ${horizontal} ${
          lado === "cima" ? "bottom-full mb-2" : "top-full mt-2"
        }`}
      >
        {texto}
      </span>
    </span>
  );
}

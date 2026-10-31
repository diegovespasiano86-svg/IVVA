"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const sem = () => () => {};

/**
 * Desenha as janelas (modais) direto no <body>. Assim elas nunca ficam presas a um bloco com
 * vidro/desfoque/animação por perto (esses efeitos mudam a referência do "fixed" e fariam a
 * janela abrir lá embaixo, no rodapé da página).
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const corpo = useSyncExternalStore(sem, () => document.body, () => null);
  return corpo ? createPortal(children, corpo) : null;
}

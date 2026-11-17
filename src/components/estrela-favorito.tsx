"use client";

import { useState, useTransition } from "react";
import { alternarFavorito } from "@/app/(app)/crm/actions";
import { Dica } from "@/components/dica";

// Estrela dourada = atalho do "Só humano" (mesma regra do CRM): marcar desliga o robô para o cliente,
// tirar devolve ao robô; vale em todas as telas porque grava no mesmo cadastro. `tom="herdar"` usa a cor do texto ao redor (cabeçalhos que mudam de cor com o tema).
export default function EstrelaFavorito({
  contactId,
  ativaInicial,
  lado = "baixo",
  alinhar = "inicio",
  tom = "padrao",
}: {
  contactId: string;
  ativaInicial: boolean;
  lado?: "cima" | "baixo";
  alinhar?: "inicio" | "centro" | "fim";
  tom?: "padrao" | "herdar";
}) {
  const [ativa, setAtiva] = useState(ativaInicial);
  const [, startTransition] = useTransition();

  function alternar() {
    const novo = !ativa;
    setAtiva(novo);
    startTransition(() => {
      alternarFavorito(contactId, novo).then((r) => {
        if (!r?.ok) setAtiva(!novo); // não salvou: desfaz a estrela na tela
      });
    });
  }

  return (
    <Dica
      lado={lado}
      alinhar={alinhar}
      texto={
        ativa
          ? "Só humano ligado. Tire a estrela para o robô voltar."
          : "Favorito liga o Só humano: o robô não responde este cliente."
      }
    >
      <button
        type="button"
        aria-label={ativa ? "Tirar dos favoritos" : "Marcar como favorito"}
        aria-pressed={ativa}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          alternar();
        }}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-purple"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6Z"
            fill={ativa ? "#E8A317" : "none"}
            stroke={ativa ? "#E8A317" : "currentColor"}
            strokeWidth="1.7"
            strokeLinejoin="round"
            className={ativa ? "" : tom === "herdar" ? "opacity-80" : "text-ink-faint"}
          />
        </svg>
      </button>
    </Dica>
  );
}

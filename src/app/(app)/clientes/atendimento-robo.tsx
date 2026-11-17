"use client";

import { useState, useTransition } from "react";
import { Bot, BellOff, UserRound } from "lucide-react";
import { definirAtendimentoRobo, type ModoRobo } from "./actions";
import { estadoRobo, rotuloEstadoRobo } from "@/lib/robo-atendimento";
import { Dica } from "@/components/dica";

type Opcao = { id: string; label: string; modo: ModoRobo; dias: number; dica: string };

const OPCOES: Opcao[] = [
  { id: "atende", label: "Robô atende", modo: "atende", dias: 0, dica: "O robô responde e agenda normalmente." },
  { id: "humano", label: "Só humano", modo: "observa", dias: 0, dica: "O robô não responde este cliente. Quem atende é você." },
  { id: "s1", label: "Silenciar 1 dia", modo: "atende", dias: 1, dica: "O robô fica quieto por 1 dia e volta sozinho." },
  { id: "s7", label: "Silenciar 7 dias", modo: "atende", dias: 7, dica: "O robô fica quieto por 7 dias e volta sozinho." },
  { id: "s30", label: "Silenciar 30 dias", modo: "atende", dias: 30, dica: "O robô fica quieto por 30 dias e volta sozinho." },
];

export default function AtendimentoRobo({
  contactId,
  modo,
  silenciadoAte,
}: {
  contactId: string;
  modo: string | null;
  silenciadoAte: string | null;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const estado = estadoRobo(modo, silenciadoAte);
  const Icone = estado.tipo === "humano" ? UserRound : estado.tipo === "silenciado" ? BellOff : Bot;

  function escolher(op: Opcao) {
    setErro(null);
    iniciar(async () => {
      const r = await definirAtendimentoRobo(contactId, op.modo, op.dias);
      if (!r.ok) setErro(r.erro ?? "Não consegui salvar.");
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Dica lado="baixo" alinhar="inicio" texto="Quem está atendendo este cliente agora: o robô, só você (humano) ou o robô silenciado até uma data.">
          <span className={`badge ${estado.tipo === "atende" ? "badge-success" : "badge-warn"}`}>
            <Icone size={12} /> {rotuloEstadoRobo(estado)}
          </span>
        </Dica>
        <label htmlFor={`robo-${contactId}`} className="sr-only">
          Atendimento do robô
        </label>
        <Dica
          lado="baixo"
          alinhar="inicio"
          texto="Escolha quem atende este cliente. “Só humano”: o robô não responde, você atende. “Silenciar”: o robô fica quieto por 1, 7 ou 30 dias e volta sozinho quando o tempo acabar."
        >
          <select
            id={`robo-${contactId}`}
            className="select !h-9 !w-auto min-w-[170px]"
            disabled={pendente}
            value=""
            onChange={(e) => {
              const op = OPCOES.find((o) => o.id === e.target.value);
              if (op) escolher(op);
            }}
          >
            <option value="">Mudar atendimento…</option>
            {OPCOES.map((o) => (
              <option key={o.id} value={o.id} title={o.dica}>
                {o.label}
              </option>
            ))}
          </select>
        </Dica>
      </div>
      {erro && <p className="text-[12px] text-coral">{erro}</p>}
    </div>
  );
}

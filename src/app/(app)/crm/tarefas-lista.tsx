"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { alternarTarefaCrm, excluirTarefaCrm } from "./actions";

export type TarefaLinhaDados = {
  id: string;
  tipo: "tarefa" | "lembrete";
  titulo: string;
  data: string;
  status: "pendente" | "concluida";
  nome: string;
  telefone: string;
};

function dataBr(iso: string) {
  return iso.split("-").reverse().join("/");
}

function Linha({ t, hoje }: { t: TarefaLinhaDados; hoje: string }) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const feita = t.status === "concluida";
  const atrasada = !feita && t.data < hoje;
  const tel = t.telefone.replace(/\D/g, "");

  function alternar() {
    iniciar(async () => {
      const r = await alternarTarefaCrm(t.id, !feita);
      setErro(r.erro ?? null);
      router.refresh();
    });
  }
  function apagar() {
    iniciar(async () => {
      const r = await excluirTarefaCrm(t.id);
      setErro(r.erro ?? null);
      router.refresh();
    });
  }

  return (
    <li className="flex items-start gap-3 rounded-[12px] border border-border bg-surface px-3.5 py-3">
      <input type="checkbox" checked={feita} onChange={alternar} className="mt-1 h-4 w-4" aria-label="Marcar como feita" />
      <div className="min-w-0 flex-1">
        <p className={`text-[13.5px] ${feita ? "text-ink-faint line-through" : "font-bold"}`}>{t.titulo}</p>
        <p className="mt-0.5 text-[12px] text-ink-soft">
          <span className="font-semibold">{t.nome}</span> · {t.tipo === "tarefa" ? "Tarefa" : "Lembrete"} ·{" "}
          <span className={atrasada ? "font-bold text-coral" : ""}>{dataBr(t.data)}{atrasada ? " (atrasada)" : ""}</span>
        </p>
        {erro && <p className="mt-1 text-[12px] font-semibold text-coral">{erro}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {tel && !feita && (
          <a
            href={`https://wa.me/${tel}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-bold text-teal hover:underline"
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
        )}
        <button type="button" onClick={apagar} className="text-[12px] text-ink-faint hover:text-coral">
          Apagar
        </button>
      </div>
    </li>
  );
}

function Grupo({ titulo, itens, hoje, destaque }: { titulo: string; itens: TarefaLinhaDados[]; hoje: string; destaque?: "coral" }) {
  if (itens.length === 0) return null;
  return (
    <section className="mb-5">
      <h3 className={`mb-2 text-[12px] font-bold uppercase tracking-wide ${destaque === "coral" ? "text-coral" : "text-ink-faint"}`}>
        {titulo} · {itens.length}
      </h3>
      <ul className="flex flex-col gap-2">
        {itens.map((t) => (
          <Linha key={t.id} t={t} hoje={hoje} />
        ))}
      </ul>
    </section>
  );
}

/** Tarefas e lembretes agrupados: atrasadas, hoje, esta semana, este mês e concluídas. */
export default function TarefasLista({
  itens,
  hoje,
  fimSemana,
  fimMes,
}: {
  itens: TarefaLinhaDados[];
  hoje: string;
  fimSemana: string;
  fimMes: string;
}) {
  const pend = itens.filter((t) => t.status === "pendente");
  const atrasadas = pend.filter((t) => t.data < hoje);
  const hojeL = pend.filter((t) => t.data === hoje);
  const semana = pend.filter((t) => t.data > hoje && t.data <= fimSemana);
  const mes = pend.filter((t) => t.data > fimSemana && t.data <= fimMes);
  const depois = pend.filter((t) => t.data > fimMes);
  const feitas = itens.filter((t) => t.status === "concluida").slice(0, 8);

  if (itens.length === 0) {
    return (
      <p className="rounded-[12px] bg-surface-soft px-4 py-8 text-center text-[13px] text-ink-faint">
        Nenhuma tarefa ou lembrete ainda. Abra um cartão do funil e crie a primeira, por exemplo: ligar para o cliente e chamar para jantar.
      </p>
    );
  }

  return (
    <div>
      <Grupo titulo="Atrasadas" itens={atrasadas} hoje={hoje} destaque="coral" />
      <Grupo titulo="Hoje" itens={hojeL} hoje={hoje} />
      <Grupo titulo="Nesta semana" itens={semana} hoje={hoje} />
      <Grupo titulo="Neste mês" itens={mes} hoje={hoje} />
      <Grupo titulo="Mais para frente" itens={depois} hoje={hoje} />
      <Grupo titulo="Concluídas recentemente" itens={feitas} hoje={hoje} />
    </div>
  );
}

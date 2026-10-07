"use client";

import { useActionState } from "react";
import { salvarTermos, type EstadoTermos } from "./termos-actions";
import type { ChaveTermo, Termos } from "@/lib/termos";

const GRUPOS: { sing: ChaveTermo; plur: ChaveTermo; titulo: string; dica: string }[] = [
  { sing: "cliente", plur: "clientes", titulo: "Quem compra de você", dica: "Cliente, paciente, aluno, hóspede, tutor…" },
  { sing: "profissional", plur: "profissionais", titulo: "Quem atende", dica: "Profissional, corretor, instrutor, técnico…" },
  { sing: "agendamento", plur: "agendamentos", titulo: "Horário marcado", dica: "Agendamento, consulta, visita, aula, reserva…" },
  { sing: "servico", plur: "servicos", titulo: "O que você presta", dica: "Serviço, procedimento, imóvel, plano, pacote…" },
  { sing: "produto", plur: "produtos", titulo: "O que você vende", dica: "Produto, prato, peça, ingresso…" },
];

export default function TermosForm({ padrao, atuais, nichoNome }: { padrao: Termos; atuais: Partial<Record<ChaveTermo, string>>; nichoNome: string }) {
  const [estado, acao, pendente] = useActionState<EstadoTermos, FormData>(salvarTermos, { erro: null });

  return (
    <form action={acao} className="card mb-4 px-5 py-5">
      <div className="mb-4">
        <p className="text-[14px] font-bold">Como você chama as coisas</p>
        <p className="text-[12.5px] text-ink-soft">
          O sistema usa o vocabulário do seu nicho ({nichoNome}). Mude qualquer palavra para ficar do seu jeito: ela troca no menu, no início, no calendário, no catálogo e no checkout.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {GRUPOS.map((g) => (
          <fieldset key={g.sing} className="rounded-[14px] border border-border px-4 py-3">
            <legend className="px-1 text-[12.5px] font-bold">{g.titulo}</legend>
            <p className="mb-2 text-[11.5px] text-ink-faint">{g.dica}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor={`t-${g.sing}`} className="!mb-1">Singular</label>
                <input id={`t-${g.sing}`} name={g.sing} maxLength={30} defaultValue={atuais[g.sing] ?? ""} placeholder={padrao[g.sing]} className="input" autoComplete="off" />
              </div>
              <div>
                <label htmlFor={`t-${g.plur}`} className="!mb-1">Plural</label>
                <input id={`t-${g.plur}`} name={g.plur} maxLength={30} defaultValue={atuais[g.plur] ?? ""} placeholder={padrao[g.plur]} className="input" autoComplete="off" />
              </div>
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" name="acao" value="salvar" disabled={pendente} className="btn btn-primary btn-md disabled:opacity-60">
          {pendente ? "Salvando…" : "Salvar vocabulário"}
        </button>
        <button type="submit" name="acao" value="restaurar" disabled={pendente} className="btn btn-secondary btn-md">
          Restaurar o padrão do nicho
        </button>
        {estado.erro && <p role="alert" className="text-[12.5px] font-semibold text-coral">{estado.erro}</p>}
        {estado.ok && <p role="status" className="anim-pop text-[12.5px] font-semibold text-teal">{estado.ok}</p>}
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Clock, Send } from "lucide-react";
import { criarModeloNaMeta, situacaoModeloNaMeta } from "../actions";

const SITUACAO: Record<string, { label: string; badge: string; dica: string }> = {
  APPROVED: { label: "Aprovado", badge: "badge-success", dica: "Pronto: a campanha já pode usar este modelo." },
  PENDING: { label: "Em análise na Meta", badge: "badge-warn", dica: "Costuma levar de alguns minutos a 1 dia. Volte aqui e clique em Ver situação." },
  IN_APPEAL: { label: "Em revisão", badge: "badge-warn", dica: "A Meta está reavaliando o modelo." },
  REJECTED: { label: "Recusado", badge: "badge-danger", dica: "Ajuste o texto e crie de novo com outro nome." },
  PAUSED: { label: "Pausado pela Meta", badge: "badge-danger", dica: "Muitos clientes bloquearam ou denunciaram esta mensagem." },
  DISABLED: { label: "Desativado pela Meta", badge: "badge-danger", dica: "Crie um modelo novo, com outro nome." },
};

/** Cria o modelo direto na Meta e mostra em que pé está a aprovação. */
export default function ModeloNaMeta({
  nome,
  idioma,
  corpo,
  whatsappAtivo,
}: {
  nome: string;
  idioma: string;
  corpo: string;
  whatsappAtivo: boolean;
}) {
  const [categoria, setCategoria] = useState<"MARKETING" | "UTILITY">("MARKETING");
  const [status, setStatus] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function criar() {
    setErro(null);
    iniciar(async () => {
      const r = await criarModeloNaMeta({ nome, idioma, corpo, categoria });
      if (r.erro !== null) return setErro(r.erro);
      setMotivo(null);
      setStatus(r.status);
    });
  }

  function consultar() {
    setErro(null);
    iniciar(async () => {
      const r = await situacaoModeloNaMeta(nome, idioma);
      if (r.erro !== null) return setErro(r.erro);
      if (!r.situacao) return setErro("A Meta ainda não tem um modelo com este nome. Crie o modelo primeiro.");
      setStatus(r.situacao.status);
      setMotivo(r.situacao.motivo);
    });
  }

  const s = status ? SITUACAO[status] ?? { label: status, badge: "badge-neutral", dica: "" } : null;
  const Icone = status === "APPROVED" ? CheckCircle2 : status === "PENDING" || status === "IN_APPEAL" ? Clock : CircleAlert;

  return (
    <div className="mt-3 rounded-xl border border-border bg-bg px-4 py-3.5">
      <p className="text-[13px] font-extrabold">Criar este modelo na Meta por aqui</p>
      <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">
        A ivva envia o nome, o idioma e o texto acima para a Meta aprovar. Você não precisa abrir o Gerenciador do WhatsApp.
      </p>

      {!whatsappAtivo ? (
        <p className="mt-2.5 text-[12.5px] text-ink-soft">
          Conecte o WhatsApp primeiro, em{" "}
          <Link href="/canais" className="font-bold text-purple hover:underline">
            Canais
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-2.5">
            <div>
              <label htmlFor="cat-modelo" className="!mb-1">Tipo de mensagem</label>
              <select id="cat-modelo" value={categoria} onChange={(e) => setCategoria(e.target.value as "MARKETING" | "UTILITY")} className="select">
                <option value="MARKETING">Divulgação (ofertas, novidades, sentimos sua falta)</option>
                <option value="UTILITY">Aviso (lembrete de horário, confirmação, pedido)</option>
              </select>
            </div>
            <button type="button" onClick={criar} disabled={pendente || !nome || !corpo.trim()} className={`btn btn-primary btn-md ${pendente ? "btn-loading" : ""}`}>
              <Send size={15} /> Criar modelo na Meta
            </button>
            <button type="button" onClick={consultar} disabled={pendente || !nome} className="btn btn-secondary btn-md">
              Ver situação
            </button>
          </div>
          {(!nome || !corpo.trim()) && <p className="mt-2 text-[11.5px] text-ink-soft">Preencha o nome e o texto do modelo acima.</p>}
        </>
      )}

      {s && (
        <p role="status" className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
          <Icone size={15} className="text-ink-soft" />
          <span className={`badge ${s.badge}`}>{s.label}</span>
          <span className="text-ink-soft">{motivo ? `Motivo informado pela Meta: ${motivo}.` : s.dica}</span>
        </p>
      )}
      {erro && (
        <p role="alert" className="mt-3 text-[12.5px] font-semibold text-coral">
          {erro}
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, RotateCcw, Send, UserRound } from "lucide-react";
import { simularResposta, type MensagemSimulada } from "./actions";

const SUGESTOES = [
  "Oi! Quais serviços vocês fazem e quanto custa?",
  "Queria marcar um horário para amanhã",
  "Vocês aceitam Pix? E cartão?",
  "Preciso cancelar meu horário",
];

export default function SimuladorChat({ nomeAssistente }: { nomeAssistente: string }) {
  const [msgs, setMsgs] = useState<MensagemSimulada[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pediuHumano, setPediuHumano] = useState(false);
  const [pendente, iniciar] = useTransition();
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, pendente]);

  function enviar(conteudo: string) {
    const t = conteudo.trim();
    if (!t || pendente) return;
    const proximo: MensagemSimulada[] = [...msgs, { remetente: "contato", conteudo: t }];
    setMsgs(proximo);
    setTexto("");
    setErro(null);
    iniciar(async () => {
      const r = await simularResposta(proximo);
      if (r.erro) setErro(r.erro);
      if (r.resposta) setMsgs((atual) => [...atual, { remetente: "bot", conteudo: r.resposta! }]);
      if (r.pediuHumano) setPediuHumano(true);
    });
  }

  function reiniciar() {
    setMsgs([]);
    setErro(null);
    setPediuHumano(false);
    setTexto("");
  }

  return (
    <div className="card flex h-[calc(100dvh-300px)] min-h-[420px] flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ece9fc] text-purple">
            <Bot size={18} />
          </span>
          <div>
            <p className="text-[13.5px] font-extrabold leading-tight">{nomeAssistente}</p>
            <p className="text-[11.5px] text-ink-soft">Você é o cliente. Escreva como ele escreveria.</p>
          </div>
        </div>
        <button type="button" onClick={reiniciar} className="btn btn-ghost btn-sm" disabled={msgs.length === 0 && !erro}>
          <RotateCcw size={14} /> Reiniciar
        </button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-bg px-4 py-4" aria-live="polite">
        {msgs.length === 0 && (
          <div className="mx-auto mt-6 max-w-[420px] text-center">
            <p className="text-[13.5px] font-bold">Teste o seu robô antes de atender clientes de verdade</p>
            <p className="mt-1 text-[12.5px] text-ink-soft">Escolha uma pergunta ou escreva a sua.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGESTOES.map((s) => (
                <button key={s} type="button" onClick={() => enviar(s)} className="btn btn-secondary btn-sm !h-auto !whitespace-normal py-2 text-left">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => {
          const cliente = m.remetente === "contato";
          return (
            <div key={i} className={`flex gap-2 ${cliente ? "justify-end" : "justify-start"}`}>
              {!cliente && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ece9fc] text-purple">
                  <Bot size={14} />
                </span>
              )}
              <div
                className={`max-w-[78%] whitespace-pre-wrap rounded-[14px] px-3.5 py-2 text-[13.5px] leading-snug ${
                  cliente ? "rounded-tr-sm bg-ink-deep text-white" : "rounded-tl-sm border border-border bg-surface"
                }`}
              >
                {m.conteudo}
              </div>
              {cliente && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-soft text-ink-soft">
                  <UserRound size={14} />
                </span>
              )}
            </div>
          );
        })}

        {pendente && (
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ece9fc] text-purple">
              <Bot size={14} />
            </span>
            <div className="skeleton h-8 w-24 !rounded-[14px]" aria-label="O robô está escrevendo" />
          </div>
        )}

        {pediuHumano && (
          <p className="mx-auto max-w-[420px] rounded-lg bg-[#fdf0dc] px-3 py-2 text-center text-[12px] font-semibold text-amber">
            Nesta resposta o robô chamaria um atendente humano. No atendimento real, a conversa iria para “Precisam de você”.
          </p>
        )}
        {erro && <p className="mx-auto max-w-[420px] rounded-lg bg-[#fdece9] px-3 py-2 text-center text-[12.5px] font-semibold text-coral">{erro}</p>}
        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="flex gap-2 border-t border-border bg-surface p-3"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={600}
          placeholder="Escreva como se fosse o cliente…"
          aria-label="Mensagem de teste"
          className="h-10 flex-1 rounded-[10px] border border-border bg-bg px-3 text-[13.5px]"
        />
        <button type="submit" disabled={pendente || !texto.trim()} className={`btn btn-primary btn-md ${pendente ? "btn-loading" : ""}`}>
          <Send size={15} /> Enviar
        </button>
      </form>
    </div>
  );
}

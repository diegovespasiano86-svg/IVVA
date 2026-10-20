"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPublico({ codigo, nome }: { codigo: string; nome: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: `Oi! Eu sou ${nome}. Como posso ajudar?` }]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || enviando) return;
    const novas: Msg[] = [...msgs, { role: "user", content: texto.trim() }];
    setMsgs(novas);
    setTexto("");
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch(`/api/robo-publico/${encodeURIComponent(codigo)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensagens: novas.slice(1) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não consegui responder.");
      setMsgs([...novas, { role: "assistant", content: d.resposta }]);
      setTimeout(() => fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui responder.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-5 flex flex-1 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-[rgba(14,14,19,0.12)] bg-white p-3" aria-live="polite">
        {msgs.map((m, i) => (
          <p key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${m.role === "user" ? "ml-auto bg-[#2fbf9f] text-white" : "bg-[#f3f1ec] text-[#0e0e13]"}`}>
            {m.content}
          </p>
        ))}
        {enviando && <p className="w-fit rounded-2xl bg-[#f3f1ec] px-3.5 py-2 text-[14px] text-[#6b6577]">digitando…</p>}
        <div ref={fim} />
      </div>
      {erro && <p role="alert" className="mt-2 rounded-xl bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">{erro}</p>}
      <form onSubmit={enviar} className="mt-3 flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={400}
          placeholder="Escreva sua mensagem"
          aria-label="Mensagem"
          className="flex-1 rounded-xl border border-[rgba(14,14,19,0.16)] bg-white px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#2fbf9f]"
        />
        <button type="submit" disabled={enviando || !texto.trim()} className="rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60">Enviar</button>
      </form>
    </div>
  );
}

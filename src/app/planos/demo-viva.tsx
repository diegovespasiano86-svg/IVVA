"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

// Demonstração viva: o visitante informa o site, a ivva lê e o robô responde com os dados dele.
export default function DemoViva() {
  const [endereco, setEndereco] = useState("");
  const [fatos, setFatos] = useState<string[] | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  async function ler(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLendo(true);
    try {
      const r = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endereco }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não consegui ler o site.");
      setFatos(d.fatos);
      setMsgs([{ role: "assistant", content: "Oi! Já li o seu site. Pergunte o que um cliente perguntaria, como preço, horário ou serviços." }]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui ler o site.");
    } finally {
      setLendo(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!fatos || !texto.trim() || enviando) return;
    const novas: Msg[] = [...msgs, { role: "user", content: texto.trim() }];
    setMsgs(novas);
    setTexto("");
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/demo/conversa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fatos, mensagens: novas.slice(1) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não consegui responder.");
      setMsgs([...novas, { role: "assistant", content: d.resposta }]);
      setTimeout(() => fim.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui responder.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="demo-titulo" className="mx-auto mb-10 max-w-[560px] rounded-3xl border border-white/12 bg-white/5 p-6">
      <h2 id="demo-titulo" className="text-[18px] font-extrabold text-[#f7f6f2]">Veja o robô falando do seu negócio</h2>
      <p className="mt-1 text-[13px] text-[#a5a3b0]">Digite o site do seu negócio. A gente lê e você conversa com o robô na hora. Nada é salvo.</p>

      {!fatos ? (
        <form onSubmit={ler} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="meusite.com.br"
            aria-label="Endereço do site do seu negócio"
            className="flex-1 rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-[14px] text-[#f7f6f2] outline-none placeholder:text-[#8a8896] focus:ring-2 focus:ring-[#2fbf9f]"
          />
          <button type="submit" disabled={lendo || !endereco.trim()} className="rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60">
            {lendo ? "Lendo o site…" : "Ler meu site"}
          </button>
        </form>
      ) : (
        <div className="mt-4">
          <div className="max-h-[260px] space-y-2 overflow-y-auto rounded-2xl bg-[#0b0b10] p-3" aria-live="polite">
            {msgs.map((m, i) => (
              <p key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug ${m.role === "user" ? "ml-auto bg-[#2fbf9f] text-white" : "bg-white/10 text-[#f7f6f2]"}`}>
                {m.content}
              </p>
            ))}
            {enviando && <p className="w-fit rounded-2xl bg-white/10 px-3.5 py-2 text-[13.5px] text-[#a5a3b0]">digitando…</p>}
            <div ref={fim} />
          </div>
          <form onSubmit={enviar} className="mt-2 flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={400}
              placeholder="Ex.: quanto custa? qual o horário?"
              aria-label="Mensagem para o robô"
              className="flex-1 rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-[14px] text-[#f7f6f2] outline-none placeholder:text-[#8a8896] focus:ring-2 focus:ring-[#2fbf9f]"
            />
            <button type="submit" disabled={enviando || !texto.trim()} className="rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60">Enviar</button>
          </form>
          <button type="button" onClick={() => { setFatos(null); setMsgs([]); setErro(null); }} className="mt-2 text-[12px] text-[#a5a3b0] hover:text-[#f7f6f2]">Usar outro site</button>
        </div>
      )}
      {erro && <p role="alert" className="mt-3 rounded-xl bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">{erro}</p>}
      <p className="mt-3 text-[11.5px] text-[#8a8896]">Lemos só o texto público da página que você informar, usamos para esta conversa e não guardamos. Respostas de demonstração podem errar; no sistema real você revisa tudo.</p>
    </section>
  );
}

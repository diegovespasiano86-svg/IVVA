"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlayCircle, Send, X } from "lucide-react";
import { guiaDaRota, guiasDoPerfil } from "@/lib/ajuda-busca";
import VideoModal from "./video-modal";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = ["Como conecto o WhatsApp?", "Como ensino o robô sobre o meu negócio?", "Como convido alguém da equipe?"];

/** Texto da resposta com links internos [tela](/rota) clicáveis. */
function Resposta({ texto, onNavegar }: { texto: string; onNavegar: () => void }) {
  const partes = texto.split(/(\[[^\]]+\]\(\/[^)\s]*\))/g);
  return (
    <p className="whitespace-pre-wrap">
      {partes.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/);
        return m ? (
          <Link key={i} href={m[2]} onClick={onNavegar} className="font-bold text-purple underline">
            {m[1]}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </p>
  );
}

/** "Pergunte a Ivva": a Vi, no canto esquerdo de todas as telas, conversa como um chat e ajuda a navegar pelo sistema. */
export default function AjudaFlutuante({ ehDono }: { ehDono: boolean }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const guias = useMemo(() => guiasDoPerfil(ehDono), [ehDono]);
  const guia = useMemo(() => guiaDaRota(pathname, guias), [pathname, guias]);
  const sugestoes = useMemo(() => (guia ? [`Como funciona a tela ${guia.titulo}?`, ...SUGESTOES.slice(0, 2)] : SUGESTOES), [guia]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && !tocando && setAberto(false);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, tocando]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, enviando, aberto]);

  async function perguntar(pergunta: string) {
    const p = pergunta.trim();
    if (!p || enviando) return;
    const historico: Msg[] = [...msgs, { role: "user", content: p }];
    setMsgs(historico);
    setTexto("");
    setEnviando(true);
    try {
      const res = await fetch("/api/ajuda/assistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensagens: historico, tela: pathname }),
      });
      const data = await res.json().catch(() => ({}));
      setMsgs([...historico, { role: "assistant", content: data.resposta ?? data.erro ?? "Não consegui responder agora." }]);
    } catch {
      setMsgs([...historico, { role: "assistant", content: "Sem conexão agora. Tente de novo em instantes." }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-24 left-4 z-40 md:bottom-6 md:left-[264px] print:hidden">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-label={aberto ? "Fechar a conversa com a Vi" : "Abrir Pergunte a Ivva"}
          aria-expanded={aberto}
          className="group flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-[0_12px_30px_-8px_rgba(139,127,232,0.7)] ring-2 ring-purple/30 transition-transform hover:scale-105"
        >
          <Image src="/vi/vi-128.webp" alt="" width={44} height={44} className="h-11 w-11 rounded-full border-2 border-white object-cover" />
          <span className="hidden text-[13px] font-extrabold text-ink sm:inline">Pergunte a Ivva</span>
        </button>
      </div>

      {aberto && (
        <div
          role="dialog"
          aria-label="Pergunte a Ivva: conversa com a Vi, assistente virtual"
          className="fixed bottom-40 left-4 z-[65] flex max-h-[min(36rem,calc(100dvh-9rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl bg-[linear-gradient(145deg,#2fbf9f,#8b7fe8_55%,#ff6b5b)] p-[1.5px] shadow-[0_40px_80px_-30px_rgba(139,127,232,0.65)] md:bottom-24 md:left-[264px] print:hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-surface">
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Image src="/vi/vi-128.webp" alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-extrabold">Pergunte a Ivva</p>
                <p className="text-[11.5px] font-semibold text-teal">Vi, assistente virtual</p>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-surface-soft">
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[13.5px]" aria-live="polite">
              <div className="mr-8 rounded-2xl rounded-bl-sm bg-surface-soft px-3.5 py-2.5">
                <p>Oi! Eu sou a Vi, da ivva. Pergunte como fazer qualquer coisa no sistema: eu explico e levo você até a tela certa.</p>
              </div>
              {msgs.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {sugestoes.map((s) => (
                    <button key={s} type="button" onClick={() => perguntar(s)} className="rounded-full border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:bg-surface-soft">
                      {s}
                    </button>
                  ))}
                  {guia?.video && (
                    <button type="button" onClick={() => setTocando(true)} className="inline-flex items-center gap-1.5 rounded-full border border-purple/40 px-3 py-1.5 text-[12.5px] font-bold text-purple hover:bg-purple/5">
                      <PlayCircle size={15} /> Ver o vídeo desta tela
                    </button>
                  )}
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "ml-8 rounded-2xl rounded-br-sm bg-purple px-3.5 py-2.5 text-white" : "mr-8 rounded-2xl rounded-bl-sm bg-surface-soft px-3.5 py-2.5"}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <Resposta texto={m.content} onNavegar={() => setAberto(false)} />}
                </div>
              ))}
              {enviando && <div className="mr-8 rounded-2xl rounded-bl-sm bg-surface-soft px-3.5 py-2.5 text-ink-soft">Pensando…</div>}
              <div ref={fimRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                perguntar(texto);
              }}
              className="flex items-center gap-2 border-t border-border px-4 py-3"
            >
              <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={400} placeholder="Escreva a sua dúvida" aria-label="Sua dúvida" className="input h-10 flex-1 text-[13.5px]" />
              <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar" className="btn btn-primary btn-sm h-10 w-10 !p-0 disabled:opacity-50">
                <Send size={16} />
              </button>
            </form>
            <div className="flex items-center justify-between border-t border-border bg-surface-soft px-4 py-2 text-[11.5px] font-semibold text-ink-soft">
              <Link href="/ajuda" onClick={() => setAberto(false)} className="underline underline-offset-2 hover:text-ink">
                Guias e vídeos
              </Link>
              <Link href="/ajuda#suporte" onClick={() => setAberto(false)} className="underline underline-offset-2 hover:text-ink">
                Falar com a equipe
              </Link>
            </div>
          </div>
        </div>
      )}

      {tocando && guia?.video && <VideoModal titulo={guia.titulo} src={guia.video} poster={guia.poster} onClose={() => setTocando(false)} />}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, PlayCircle, Search, Send, X } from "lucide-react";
import { buscarGuias, guiaDaRota, guiasDoPerfil } from "@/lib/ajuda-busca";
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

/** Botão "Ajuda" em todas as telas: vídeo e passos da tela atual, busca e assistente. */
export default function AjudaFlutuante({ ehDono }: { ehDono: boolean }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<"tela" | "perguntar">("tela");
  const [q, setQ] = useState("");
  const [tocando, setTocando] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const guias = useMemo(() => guiasDoPerfil(ehDono), [ehDono]);
  const guia = useMemo(() => guiaDaRota(pathname, guias), [pathname, guias]);
  const achados = useMemo(() => (q.trim() ? buscarGuias(q, guias).slice(0, 5) : []), [q, guias]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && !tocando && setAberto(false);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, tocando]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, enviando]);

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
        body: JSON.stringify({ mensagens: historico }),
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
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir a ajuda"
        className="fixed bottom-24 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-purple px-4 text-[13px] font-extrabold text-white shadow-[0_10px_28px_-8px_rgba(109,91,224,0.8)] transition-transform hover:scale-105 md:bottom-1/3 print:hidden"
      >
        <CircleHelp size={19} /> <span className="hidden sm:inline">Ajuda</span>
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[65] print:hidden" role="dialog" aria-modal="true" aria-label="Ajuda">
          <button className="absolute inset-0 bg-ink-deep/30" aria-label="Fechar ajuda" onClick={() => setAberto(false)} />
          <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-[400px] flex-col bg-surface shadow-[-24px_0_64px_-12px_rgba(20,18,27,0.4)]">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-[15px] font-extrabold">Ajuda</p>
                <p className="text-[12px] text-ink-soft">Vídeos, passos e um assistente para tirar dúvidas.</p>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-surface-soft">
                <X size={18} />
              </button>
            </header>

            <div className="flex gap-1 border-b border-border px-3 pt-2" role="tablist">
              {([["tela", "Esta tela"], ["perguntar", "Perguntar"]] as const).map(([id, rotulo]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={aba === id}
                  onClick={() => setAba(id)}
                  className={`rounded-t-lg px-4 py-2 text-[13px] font-bold ${aba === id ? "border-b-2 border-purple text-purple" : "text-ink-soft"}`}
                >
                  {rotulo}
                </button>
              ))}
            </div>

            {aba === "tela" ? (
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <label className="relative mb-4 block">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar na ajuda" aria-label="Buscar na ajuda" className="input h-10 !pl-9 text-[13.5px]" />
                </label>

                {q.trim() ? (
                  <ul className="space-y-1.5">
                    {achados.length === 0 && <li className="text-[13px] text-ink-soft">Nada encontrado. Tente a aba Perguntar.</li>}
                    {achados.map((g) => (
                      <li key={g.id}>
                        <Link href={`/ajuda?abrir=${g.id}`} onClick={() => setAberto(false)} className="block rounded-lg px-3 py-2 hover:bg-surface-soft">
                          <span className="block text-[13.5px] font-bold">{g.titulo}</span>
                          <span className="block text-[12px] text-ink-soft">{g.resumo}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : guia ? (
                  <div>
                    <h3 className="text-[15px] font-extrabold">{guia.titulo}</h3>
                    <p className="mb-3 text-[12.5px] text-ink-soft">{guia.resumo}</p>
                    {guia.video && (
                      <button type="button" onClick={() => setTocando(true)} className="relative mb-4 block aspect-video w-full overflow-hidden rounded-xl bg-ink-deep" aria-label={`Assistir: ${guia.titulo}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {guia.poster && <img src={guia.poster} alt="" className="h-full w-full object-cover" />}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <PlayCircle size={42} strokeWidth={1.5} className="text-white" />
                        </span>
                      </button>
                    )}
                    <ol className="list-decimal space-y-2 pl-5 text-[13px] text-ink-soft">
                      {guia.passos.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <p className="text-[13px] text-ink-soft">Não há um guia específico para esta tela. Veja todos na central de ajuda ou pergunte ao assistente.</p>
                )}

                <Link href="/ajuda" onClick={() => setAberto(false)} className="btn btn-secondary btn-sm mt-5">
                  Ver todos os vídeos e guias
                </Link>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-[13.5px]">
                  {msgs.length === 0 && (
                    <div>
                      <p className="mb-3 text-ink-soft">Oi! Pergunte como fazer qualquer coisa no sistema. Eu explico e indico a tela certa.</p>
                      <div className="flex flex-wrap gap-2">
                        {SUGESTOES.map((s) => (
                          <button key={s} type="button" onClick={() => perguntar(s)} className="rounded-full border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:bg-surface-soft">
                            {s}
                          </button>
                        ))}
                      </div>
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
              </div>
            )}
          </aside>
        </div>
      )}

      {tocando && guia?.video && <VideoModal titulo={guia.titulo} src={guia.video} poster={guia.poster} onClose={() => setTocando(false)} />}
    </>
  );
}

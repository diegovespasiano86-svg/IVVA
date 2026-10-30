"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, PlayCircle, Send, Square, Volume2, X } from "lucide-react";
import { guiaDaRota, guiasDoPerfil } from "@/lib/ajuda-busca";
import VideoModal from "./video-modal";

type Msg = { role: "user" | "assistant"; content: string };
type Pend = { total: number; essenciais: number; urgente: boolean; itens: { id: string; texto: string; href: string; essencial: boolean }[] };

const CHAVE_DEPOIS = "ivva:pendencias-depois";
const hoje = () => new Date().toISOString().slice(0, 10);

/** "a, b e c" */
function listar(textos: string[]) {
  if (textos.length <= 1) return textos[0] ?? "";
  return `${textos.slice(0, -1).join(", ")} e ${textos[textos.length - 1]}`;
}

const SUGESTOES = ["Como conecto o WhatsApp?", "Meu robô não está respondendo", "Como convido alguém da equipe?"];

/** Texto da resposta com links internos [tela](/rota) clicáveis. */
function Resposta({ texto, onNavegar }: { texto: string; onNavegar: () => void }) {
  const partes = texto.replaceAll("**", "").split(/(\[[^\]]+\]\(\/[^)\s]*\))/g);
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

/** "Pergunte a Ivva": a Ivva, fixa no topo de todas as telas, conversa como um chat e ajuda a navegar pelo sistema.
 *  Enquanto faltar cadastro (lib/pendencias.ts), o círculo em volta dela pisca com um selo (número ou "!"); ao clicar, ela diz o que falta. */
export default function AjudaFlutuante({ ehDono }: { ehDono: boolean }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const [pend, setPend] = useState<Pend | null>(null);
  const totalAntes = useRef<number | null>(null);
  // Voz (opcional): "Ouvir" lê a resposta em voz alta; o microfone transforma a fala em pergunta. Só gasta quando a pessoa aperta.
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [ouvindo, setOuvindo] = useState<number | null>(null);
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const [calmo, setCalmo] = useState(false); // "Depois": o círculo para de piscar até o próximo cadastro
  const [chegou, setChegou] = useState(false); // pulsada quando ela termina o voo do popup de boas-vindas

  const guias = useMemo(() => guiasDoPerfil(ehDono), [ehDono]);
  const guia = useMemo(() => guiaDaRota(pathname, guias), [pathname, guias]);
  const sugestoes = useMemo(() => (guia ? [`Como funciona a tela ${guia.titulo}?`, ...SUGESTOES.slice(0, 2)] : SUGESTOES), [guia]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && !tocando && setAberto(false);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, tocando]);

  // Primeiro nome de quem está logado: a Ivva abre a conversa chamando a pessoa pelo nome.
  useEffect(() => {
    if (!aberto || nome) return;
    fetch("/api/ajuda/assistente")
      .then((r) => r.json())
      .then((d) => typeof d?.nome === "string" && setNome(d.nome))
      .catch(() => {});
  }, [aberto, nome]);

  // O que ainda falta no cadastro (só para o dono): lido de novo a cada tela, então muda sozinho depois de cada cadastro.
  useEffect(() => {
    if (!ehDono) return;
    let vivo = true;
    fetch("/api/ajuda/pendencias", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Pend | null) => {
        if (!vivo || !d) return;
        // Cadastro novo (o total mudou): volta a piscar mesmo que tenha escolhido "Depois".
        if (totalAntes.current !== null && totalAntes.current !== d.total) {
          try {
            localStorage.removeItem(CHAVE_DEPOIS);
          } catch {}
          setCalmo(false);
        }
        totalAntes.current = d.total;
        setPend(d);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [ehDono, pathname]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê localStorage só no navegador
      setCalmo(localStorage.getItem(CHAVE_DEPOIS) === hoje());
    } catch {}
    const aoChegar = () => {
      setChegou(true);
      window.setTimeout(() => setChegou(false), 1400);
    };
    window.addEventListener("ivva:chegou", aoChegar);
    return () => window.removeEventListener("ivva:chegou", aoChegar);
  }, []);

  function pararAudio() {
    playerRef.current?.pause();
    playerRef.current = null;
    setOuvindo(null);
  }

  // Ao fechar a conversa, a voz para.
  useEffect(() => {
    if (!aberto) {
      playerRef.current?.pause();
      playerRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- zera o estado do botão Ouvir ao fechar
      setOuvindo(null);
    }
  }, [aberto]);

  async function ouvir(i: number, conteudo: string) {
    if (ouvindo === i) return pararAudio();
    pararAudio();
    setAvisoVoz(null);
    setOuvindo(i);
    try {
      const res = await fetch("/api/ajuda/voz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texto: conteudo }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.erro ?? "A voz da Ivva não está disponível agora.");
      }
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      playerRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setOuvindo((atual) => (atual === i ? null : atual));
      };
      await audio.play();
    } catch (e) {
      setOuvindo(null);
      setAvisoVoz(e instanceof Error ? e.message : "A voz da Ivva não está disponível agora.");
    }
  }

  async function alternarMicrofone() {
    setAvisoVoz(null);
    if (gravando) {
      gravadorRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAvisoVoz("Este navegador não permite gravar a voz. Escreva a sua dúvida.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(stream);
      pedacosRef.current = [];
      gravador.ondataavailable = (e) => e.data.size > 0 && pedacosRef.current.push(e.data);
      gravador.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setGravando(false);
        const blob = new Blob(pedacosRef.current, { type: gravador.mimeType || "audio/webm" });
        if (blob.size < 1500) return;
        setTranscrevendo(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "pergunta.webm");
          const res = await fetch("/api/ajuda/voz", { method: "POST", body: form });
          const d = await res.json().catch(() => ({}));
          if (!res.ok || !d.texto) throw new Error(d.erro ?? "Não consegui entender o áudio. Escreva a sua dúvida.");
          await perguntar(d.texto);
        } catch (e) {
          setAvisoVoz(e instanceof Error ? e.message : "Não consegui entender o áudio. Escreva a sua dúvida.");
        } finally {
          setTranscrevendo(false);
        }
      };
      gravadorRef.current = gravador;
      gravador.start();
      setGravando(true);
    } catch {
      setAvisoVoz("Não consegui acessar o microfone. Libere o microfone no navegador ou escreva a sua dúvida.");
    }
  }

  function depois() {
    setCalmo(true);
    setAberto(false);
    try {
      localStorage.setItem(CHAVE_DEPOIS, hoje());
    } catch {}
  }

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
      {/* Fixo na barra do topo (header), em todas as telas */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? "Fechar a conversa com a Ivva" : pend?.total ? `Abrir Pergunte a Ivva: ${pend.total} pendências no cadastro` : "Abrir Pergunte a Ivva"}
        aria-expanded={aberto}
        className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-1 text-[13px] font-extrabold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 md:pr-4"
      >
        <span className="relative inline-flex h-8 w-8 shrink-0">
          {pend && pend.total > 0 && !calmo && !aberto && (
            <span aria-hidden="true" className="absolute -inset-1 rounded-full border-2 border-white/90 motion-safe:animate-ping" />
          )}
          {chegou && <span aria-hidden="true" className="absolute -inset-1.5 rounded-full border-2 border-white motion-safe:animate-ping" />}
          <Image id="ivva-avatar-topo" src="/vi/vi-128.webp" alt="" width={32} height={32} className="relative h-8 w-8 rounded-full border-2 border-white/80 object-cover" />
          {pend && pend.total > 0 && (
            <span aria-hidden="true" className={`absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-[#2a2650] ${pend.urgente ? "bg-coral" : "bg-purple"}`}>
              {pend.urgente ? "!" : pend.total > 9 ? "9+" : pend.total}
            </span>
          )}
        </span>
        <span className="hidden md:inline">Pergunte a Ivva</span>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Pergunte a Ivva: conversa com a Ivva, assistente virtual"
          className="fixed right-2 top-16 z-[65] flex max-h-[min(36rem,calc(100dvh-5rem))] w-[min(23rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-3xl bg-[linear-gradient(145deg,#2fbf9f,#8b7fe8_55%,#ff6b5b)] p-[1.5px] text-ink shadow-[0_40px_80px_-30px_rgba(139,127,232,0.65)] md:right-5 print:hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-surface">
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Image src="/vi/vi-128.webp" alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-extrabold">Pergunte a Ivva</p>
                <p className="text-[11.5px] font-semibold text-teal">Ivva, assistente virtual</p>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-surface-soft">
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[13.5px]" aria-live="polite">
              <div className="mr-8 rounded-2xl rounded-bl-sm bg-surface-soft px-3.5 py-2.5">
                <p>
                  Oi{nome ? `, ${nome}` : ""}! 👋 Eu sou a Ivva. Me conta o que você precisa: eu explico, mostro o vídeo e levo você até a tela certa 💜
                </p>
              </div>
              {msgs.length === 0 && pend && pend.total > 0 && (
                <div className="mr-8 rounded-2xl rounded-bl-sm bg-purple/10 px-3.5 py-2.5">
                  <p>
                    Olha, percebi que ainda falta {listar(pend.itens.slice(0, 4).map((i) => i.texto))}
                    {pend.itens.length > 4 ? ` (e mais ${pend.itens.length - 4})` : ""}. Isso ajuda o robô a responder certo. Quer completar agora?
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Link href={pend.itens[0].href} onClick={() => setAberto(false)} className="btn btn-primary btn-sm">
                      Responder agora
                    </Link>
                    <button type="button" onClick={depois} className="rounded-full border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:bg-surface-soft">
                      Depois
                    </button>
                  </div>
                </div>
              )}
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
                  {m.role === "assistant" && (
                    <button type="button" onClick={() => ouvir(i, m.content)} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] font-bold text-ink-soft hover:bg-surface">
                      {ouvindo === i ? <Square size={12} /> : <Volume2 size={13} />} {ouvindo === i ? "Parar" : "Ouvir"}
                    </button>
                  )}
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
              <button
                type="button"
                onClick={alternarMicrofone}
                disabled={transcrevendo || enviando}
                aria-label={gravando ? "Parar de gravar e enviar" : "Falar a sua dúvida"}
                aria-pressed={gravando}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border disabled:opacity-50 ${gravando ? "bg-coral text-white motion-safe:animate-pulse" : "text-ink-soft hover:bg-surface-soft"}`}
              >
                {gravando ? <Square size={15} /> : <Mic size={16} />}
              </button>
              <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={400} placeholder={gravando ? "Ouvindo… toque no quadrado para enviar" : transcrevendo ? "Entendendo o áudio…" : "Escreva ou fale a sua dúvida"} aria-label="Sua dúvida" className="input h-10 min-w-0 flex-1 text-[13.5px]" />
              <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar" className="btn btn-primary btn-sm h-10 w-10 !p-0 disabled:opacity-50">
                <Send size={16} />
              </button>
            </form>
            {avisoVoz && (
              <p role="status" className="border-t border-border bg-coral/10 px-4 py-2 text-[12px] font-semibold text-coral">
                {avisoVoz}
              </p>
            )}
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

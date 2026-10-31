"use client";
import Portal from "@/components/portal";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Square, Volume2, X } from "lucide-react";
import { APRESENTACAO, pararFrases, tocarFrases, vozLigada } from "@/lib/voz-ivva";

const CHAVE = "ivva:boas-vindas-modal";
const CHAVE_VIDEO = "ivva:boas-vindas-video";

type Passo = { titulo: string; texto: string; href: string; feito: boolean };

/** Ao fechar, a Ivva encolhe e voa até o lugar fixo dela (botão do topo) e dá uma pulsada ao chegar. */
function voarParaOTopo() {
  const origem = document.getElementById("ivva-avatar-modal");
  const alvo = document.getElementById("ivva-avatar-topo");
  const chegou = () => window.dispatchEvent(new Event("ivva:chegou"));
  if (!origem || !alvo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    chegou();
    return;
  }
  const a = origem.getBoundingClientRect();
  const b = alvo.getBoundingClientRect();
  if (!b.width) {
    chegou();
    return;
  }
  const voo = document.createElement("img");
  voo.src = (origem as HTMLImageElement).currentSrc || (origem as HTMLImageElement).src;
  voo.alt = "";
  Object.assign(voo.style, {
    position: "fixed",
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    borderRadius: "9999px",
    objectFit: "cover",
    border: "2px solid rgba(255,255,255,.85)",
    transformOrigin: "top left",
    zIndex: "90",
    pointerEvents: "none",
  });
  document.body.appendChild(voo);
  const anim = voo.animate(
    [
      { transform: "translate(0px,0px) scale(1)" },
      { transform: `translate(${(b.left - a.left) * 0.5}px,${(b.top - a.top) * 0.5 - 40}px) scale(0.7)`, offset: 0.55 },
      { transform: `translate(${b.left - a.left}px,${b.top - a.top}px) scale(${b.width / a.width})` },
    ],
    { duration: 900, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" },
  );
  anim.onfinish = () => {
    voo.remove();
    chegou();
  };
}

/** Popup da Ivva depois do vídeo de boas-vindas: acolhe, aponta a base de conhecimento como primeiro passo e se despede voando para o topo. */
export default function BoasVindasModal({ nome, passos }: { nome?: string; passos: Passo[] }) {
  const [aberto, setAberto] = useState(false);

  // Conectar o WhatsApp vai por último: depende de a conta estar pronta e o robô já ensinado.
  const pendentes = [...passos].sort((a, b) => Number(a.href === "/canais") - Number(b.href === "/canais")).filter((p) => !p.feito);
  const temPendente = pendentes.length > 0;

  useEffect(() => {
    if (!temPendente) return;
    const abrir = () => {
      try {
        if (localStorage.getItem(CHAVE) !== "1") setAberto(true);
      } catch {
        setAberto(true);
      }
    };
    // Aparece quando o vídeo de boas-vindas termina ou é dispensado (ou se ele já foi visto numa visita anterior).
    let jaVisto = false;
    try {
      jaVisto = localStorage.getItem(CHAVE_VIDEO) === "1";
    } catch {}
    const id = jaVisto ? window.setTimeout(abrir, 400) : undefined;
    window.addEventListener("ivva:video-fim", abrir);
    return () => {
      window.removeEventListener("ivva:video-fim", abrir);
      if (id) window.clearTimeout(id);
    };
  }, [temPendente]);

  const [falando, setFalando] = useState(false);

  async function falar() {
    if (falando) {
      pararFrases();
      setFalando(false);
      return;
    }
    setFalando(true);
    await tocarFrases(APRESENTACAO, () => setFalando(false));
    setFalando(false);
  }

  // A Ivva se apresenta em voz assim que o popup abre. Se o navegador bloquear o som, o botão "Ouvir a Ivva" fica à mão.
  useEffect(() => {
    if (!aberto || !vozLigada()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia a fala ao abrir o popup
    setFalando(true);
    tocarFrases(APRESENTACAO, () => setFalando(false)).then((ok) => !ok && setFalando(false));
    return () => pararFrases();
  }, [aberto]);

  function fechar() {
    pararFrases();
    voarParaOTopo();
    setAberto(false);
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {}
  }

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  if (!aberto || !temPendente) return null;

  return (
    <Portal><div className="fixed inset-0 z-[80] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="A Ivva se apresenta">
      <button className="absolute inset-0 bg-ink-deep/70" aria-label="Fechar" onClick={fechar} />
      <div className="card relative w-full max-w-[520px] px-6 py-6">
        <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-3 top-3 rounded-full p-1.5 text-ink-soft hover:bg-surface-soft">
          <X size={16} />
        </button>
        <div className="flex items-center gap-3">
          <Image id="ivva-avatar-modal" src="/vi/vi-256.webp" alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-full border-2 border-purple/30 object-cover" priority />
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Oi{nome ? `, ${nome}` : ""}! Eu sou a Ivva</p>
            <h2 className="mt-0.5 text-[20px] font-extrabold leading-tight">Você não está sozinho(a) na configuração</h2>
          </div>
        </div>

        <div className="mt-4 space-y-2.5 text-[13.5px] leading-snug text-ink-soft">
          <p>Eu vou te ajudar em todo o processo.</p>
          <p>
            <b className="text-ink">Para começarmos, o mais importante é a Base de conhecimento:</b> é dela que o robô tira as respostas. Você pode subir um arquivo, escrever ou falar, e eu organizo tudo para você.
          </p>
          <p>Depois seguimos com os clientes, o catálogo e a agenda. Cada passo tem um vídeo curto: acesse em <Link href="/ajuda" onClick={fechar} className="font-bold text-purple hover:underline">Guias e vídeos</Link> ou me peça que eu mostro.</p>
          <p>Se achar que o cadastro não está completo, é só me chamar: eu trago o que já concluímos e o que falta. Estou aqui no topo, é só clicar em mim. 💜</p>
        </div>

        <button type="button" onClick={falar} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12.5px] font-bold text-ink-soft hover:bg-surface-soft">
          {falando ? <Square size={12} /> : <Volume2 size={14} />} {falando ? "Parar" : "Ouvir a Ivva"}
        </button>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/base-conhecimento" onClick={fechar} className="btn btn-primary btn-md">
            Começar pela base de conhecimento
          </Link>
          <button type="button" onClick={fechar} className="ml-auto text-[12.5px] font-semibold text-ink-faint hover:text-ink">
            Agora não
          </button>
        </div>
      </div>
    </div></Portal>
  );
}

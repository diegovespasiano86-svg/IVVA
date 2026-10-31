"use client";
import Portal from "@/components/portal";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { linkSuporte, SUPORTE_HORARIO, SUPORTE_WHATSAPP_LABEL, URGENCIAS, type Urgencia } from "@/lib/suporte";

type Contexto = { negocio?: string; plano?: string; email?: string };

/**
 * Botão "Falar com o suporte": a pessoa escolhe a urgência, conta o que aconteceu e o WhatsApp
 * da ivva abre com tudo preenchido (negócio, plano, e-mail e a tela em que ela estava).
 */
export default function FalarComSuporte({
  contexto,
  className,
  children,
}: {
  contexto: Contexto;
  className?: string;
  children?: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={className ?? "btn btn-primary btn-md"}>
        {children ?? (
          <>
            <MessageCircle size={16} /> Falar com o suporte
          </>
        )}
      </button>
      {aberto && <SuporteModal contexto={contexto} onFechar={() => setAberto(false)} />}
    </>
  );
}

/** A janela em si. Fica fora de menus que fecham sozinhos (ex.: menu do usuário). */
export function SuporteModal({ contexto, onFechar }: { contexto: Contexto; onFechar: () => void }) {
  const [urgencia, setUrgencia] = useState<Urgencia>("normal");
  const [mensagem, setMensagem] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const link = linkSuporte({ urgencia, mensagem, tela: pathname, ...contexto });
  const pronto = mensagem.trim().length >= 5;

  return (
        <Portal><div className="fixed inset-0 z-[90] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Falar com o suporte">
          <button className="absolute inset-0 bg-ink-deep/70" aria-label="Fechar" onClick={() => onFechar()} />
          <div className="card relative w-full max-w-[500px] px-6 py-6 text-left text-ink">
            <button type="button" onClick={() => onFechar()} aria-label="Fechar" className="absolute right-3 top-3 rounded-full p-1.5 text-ink-soft hover:bg-surface-soft">
              <X size={16} />
            </button>
            <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Suporte ivva</p>
            <h2 className="mt-1 text-[20px] font-extrabold leading-tight">Falar com o suporte</h2>
            <p className="mt-1.5 text-[13px] leading-snug text-ink-soft">
              A conversa abre no nosso WhatsApp, {SUPORTE_WHATSAPP_LABEL}, já com os dados do seu negócio. Atendemos em {SUPORTE_HORARIO}.
            </p>

            <fieldset className="mt-4 flex flex-col gap-2">
              <legend className="mb-2 text-[13px] font-bold">Qual a urgência?</legend>
              {URGENCIAS.map((u) => (
                <label
                  key={u.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 ${urgencia === u.id ? "border-purple bg-purple/5" : "border-border"}`}
                >
                  <input
                    type="radio"
                    name="urgencia"
                    value={u.id}
                    checked={urgencia === u.id}
                    onChange={() => setUrgencia(u.id)}
                    className="mt-1 accent-[#6d5be0]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold">
                      {u.nome} <span className="font-semibold text-ink-soft">· resposta em {u.prazo}</span>
                    </span>
                    <span className="block text-[12px] leading-snug text-ink-soft">{u.quando}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="mt-4 block">
              <span className="text-[13px] font-bold">O que aconteceu?</span>
              <textarea
                id="suporte-mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
                placeholder="Ex.: o robô não respondeu os clientes desde as 14h"
                className="input mt-1.5 w-full resize-y"
              />
            </label>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={pronto ? link : undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!pronto}
                onClick={(e) => {
                  if (!pronto) return e.preventDefault();
                  onFechar();
                  setMensagem("");
                }}
                className={`btn btn-primary btn-md ${pronto ? "" : "pointer-events-none opacity-50"}`}
              >
                <MessageCircle size={16} /> Abrir no WhatsApp
              </a>
              <span className="text-[12px] text-ink-faint">{pronto ? "Revise a mensagem no WhatsApp e envie." : "Conte o que aconteceu para continuar."}</span>
            </div>
          </div>
        </div></Portal>
  );
}

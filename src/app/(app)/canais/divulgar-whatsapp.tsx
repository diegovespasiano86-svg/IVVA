"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, QrCode } from "lucide-react";

/** Link, QR Code e botão para o cliente abrir a conversa direto no WhatsApp do negócio. */
export default function DivulgarWhatsApp({ telefone, negocio }: { telefone: string; negocio: string }) {
  const numero = telefone.replace(/\D/g, "");
  const [mensagem, setMensagem] = useState("Olá! Gostaria de agendar um horário.");
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const link = useMemo(() => `https://wa.me/${numero}${mensagem.trim() ? `?text=${encodeURIComponent(mensagem.trim())}` : ""}`, [numero, mensagem]);
  const botao = `<a href="${link}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;font-family:sans-serif;font-weight:700;padding:12px 18px;border-radius:999px;text-decoration:none">Falar no WhatsApp</a>`;

  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(link, { width: 520, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => vivo && setQr(url))
      .catch(() => vivo && setQr(null));
    return () => {
      vivo = false;
    };
  }, [link]);

  async function copiar(texto: string, qual: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      setCopiado(null);
    }
  }

  if (!numero) return null;

  return (
    <section className="card mb-5 px-5 py-4">
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
        <QrCode size={18} className="text-purple" /> Divulgue o seu WhatsApp
      </h2>
      <p className="mb-4 text-[12.5px] text-ink-soft">
        Um link e um QR Code que abrem a conversa com o seu número, já com a primeira mensagem escrita. Use no Instagram, no balcão, no cartão e no site.
      </p>

      <div className="grid items-start gap-5 md:grid-cols-[1fr_220px]">
        <div className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="msg-divulgar">Mensagem que o cliente já encontra escrita</label>
            <input id="msg-divulgar" value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={200} className="input" />
          </div>

          <div>
            <label htmlFor="link-divulgar">Link</label>
            <div className="flex gap-2">
              <input id="link-divulgar" value={link} readOnly className="input" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={() => copiar(link, "link")} className="btn btn-secondary btn-md shrink-0">
                {copiado === "link" ? <Check size={15} /> : <Copy size={15} />} {copiado === "link" ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="mt-1 text-[11.5px] text-ink-soft">Cole na bio do Instagram, nos anúncios e nas mensagens.</p>
          </div>

          <details className="rounded-xl border border-border bg-bg px-4 py-3">
            <summary className="cursor-pointer text-[12.5px] font-bold text-purple">Botão “Falar no WhatsApp” para o seu site</summary>
            <p className="mt-2.5 text-[12px] text-ink-soft">Copie o código e peça para quem cuida do site colar onde o botão deve aparecer.</p>
            <textarea value={botao} readOnly rows={4} className="textarea mt-2 font-mono text-[11.5px]" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={() => copiar(botao, "botao")} className="btn btn-secondary btn-sm mt-2">
              {copiado === "botao" ? <Check size={14} /> : <Copy size={14} />} {copiado === "botao" ? "Copiado" : "Copiar código"}
            </button>
          </details>
        </div>

        <div className="rounded-xl border border-border bg-white p-3 text-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR Code do WhatsApp de ${negocio || "seu negócio"}`} className="mx-auto h-auto w-full max-w-[190px]" />
          ) : (
            <div className="mx-auto aspect-square w-full max-w-[190px] rounded-lg bg-surface-soft" />
          )}
          {qr && (
            <a href={qr} download="qrcode-whatsapp.png" className="btn btn-secondary btn-sm mt-2">
              Baixar QR Code
            </a>
          )}
          <p className="mt-2 text-[11px] leading-snug text-[#5d5672]">Imprima e deixe no balcão ou na vitrine.</p>
        </div>
      </div>
    </section>
  );
}

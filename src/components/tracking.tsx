"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

// Medição do funil de cadastro (/planos e /bem-vindo): mesmos GA4, Meta Pixel e Clarity do site ivva.app.br.
// Só carrega DEPOIS do aceite (LGPD). O aceite do site não vale aqui (origem diferente), então o aviso aparece de novo.
// IDs públicos (aparecem no código servido de qualquer forma). Manter iguais aos do repositório ivva-site.
const GA4 = process.env.NEXT_PUBLIC_GA4_ID ?? "G-E5EL2EN7RN";
const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "3206200489771186";
const CLARITY = process.env.NEXT_PUBLIC_CLARITY_ID ?? "z0zhfxlbty";
const KEY = "ivva:consent";

type W = Window & {
  gtag?: (...a: unknown[]) => void;
  fbq?: (...a: unknown[]) => void;
};

export default function Tracking() {
  const [consent, setConsent] = useState<"all" | "essential" | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const v = localStorage.getItem(KEY);
        if (v === "all" || v === "essential") setConsent(v);
      } catch {}
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!ready) return null;

  function choose(v: "all" | "essential") {
    try {
      localStorage.setItem(KEY, v);
    } catch {}
    setConsent(v);
  }

  return (
    <>
      {consent === "all" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`
            window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
            window.gtag=gtag;gtag('js',new Date());gtag('config','${GA4}');
          `}</Script>
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
            s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${PIXEL}');fbq('track','PageView');
          `}</Script>
          <Script id="clarity" strategy="afterInteractive">{`
            (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY}");
          `}</Script>
        </>
      )}

      {consent === null && (
        <div
          role="dialog"
          aria-label="Aviso de cookies"
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-4 text-[#0e0e13] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
        >
          <p className="text-[13px] leading-relaxed text-[#4a4955]">
            Usamos cookies para entender como o cadastro é usado e melhorar nossos anúncios. Você escolhe.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => choose("all")}
              className="rounded-full bg-[#0e0e13] px-5 py-2 text-[13px] font-semibold text-white"
            >
              Aceitar
            </button>
            <button
              type="button"
              onClick={() => choose("essential")}
              className="rounded-full border border-black/20 px-5 py-2 text-[13px] font-semibold"
            >
              Só o essencial
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Dispara UMA vez (por chave) um evento de conversão, assim que os rastreadores carregarem.
// Sem aceite de cookies não dispara nada. Dedupe em localStorage evita contar de novo ao recarregar a página.
export function TrackEvent({
  ga,
  fb,
  dedupeKey,
  params,
}: {
  ga: string;
  fb: string[];
  dedupeKey: string;
  params?: Record<string, unknown>;
}) {
  useEffect(() => {
    const k = `ivva:evt:${dedupeKey}`;
    try {
      if (localStorage.getItem(k)) return;
    } catch {}
    let tries = 0;
    const id = window.setInterval(() => {
      const w = window as W;
      tries += 1;
      if (w.gtag || w.fbq) {
        window.clearInterval(id);
        w.gtag?.("event", ga, params ?? {});
        fb.forEach((e) => w.fbq?.("track", e, params ?? {}));
        try {
          localStorage.setItem(k, "1");
        } catch {}
      } else if (tries > 60) {
        window.clearInterval(id); // 30 s sem rastreadores: sem aceite, não mede
      }
    }, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

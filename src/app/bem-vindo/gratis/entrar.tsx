"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ativarTesteGratis } from "./actions";

const CARTAO = "rounded-3xl bg-white keep-light p-7 text-center text-[#0e0e13] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]";
const BOTAO =
  "mt-6 inline-flex rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)]";

type W = Window & { __ivvaAuth?: string; gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void };

export default function Entrar() {
  const [falha, setFalha] = useState<{ erro: string; entrar?: boolean } | null>(null);
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    (async () => {
      try {
        const w = window as W;
        // O link do e-mail traz a sessão depois do "#" (guardada e tirada do endereço antes das medições).
        const p = new URLSearchParams((w.__ivvaAuth || window.location.hash).slice(1));
        if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
        const access_token = p.get("access_token");
        const refresh_token = p.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await createClient().auth.setSession({ access_token, refresh_token });
          if (error) console.error("[teste-gratis] sessão", error.message);
        }
        const r = await ativarTesteGratis();
        if (!r.ok) return setFalha(r);
        if (r.novo) {
          w.gtag?.("event", "sign_up", { method: "teste_gratis" });
          w.fbq?.("track", "CompleteRegistration");
          w.fbq?.("track", "StartTrial");
        }
        window.location.assign(r.novo ? "/dashboard?boas-vindas=1" : "/dashboard");
      } catch (err) {
        console.error("[teste-gratis]", err);
        setFalha({ erro: "Não conseguimos abrir o seu acesso agora. Atualize a página.", entrar: true });
      }
    })();
  }, []);

  if (!falha) {
    return (
      <div className={CARTAO} role="status">
        <h1 className="text-[20px] font-extrabold">E-mail confirmado 🎉</h1>
        <p className="mt-2 text-[13.5px] text-[#5d5770]">Montando o seu negócio. Em instantes você está dentro da ivva.</p>
      </div>
    );
  }
  return (
    <div className={CARTAO}>
      <h1 className="text-[20px] font-extrabold">Falta um passo</h1>
      <p className="mt-2 text-[13.5px] text-[#5d5770]">{falha.erro}</p>
      {falha.entrar && (
        <a href="/login" className={BOTAO}>
          Entrar
        </a>
      )}
    </div>
  );
}

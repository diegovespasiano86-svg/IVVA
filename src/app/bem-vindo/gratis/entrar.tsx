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
  const [pronto, setPronto] = useState<{ email: string; novo: boolean } | null>(null);
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
        // Link vencido ou já usado: o Supabase devolve o erro no endereço.
        if (p.get("error")) {
          return setFalha({ erro: "Esse link expirou ou já foi usado. Se você já confirmou, entre com o seu e-mail e a senha.", entrar: true });
        }
        if (access_token && refresh_token) {
          const { error } = await createClient().auth.setSession({ access_token, refresh_token });
          // Sem a sessão do link não dá para seguir (e não vale usar outra conta aberta neste aparelho).
          if (error) {
            console.error("[teste-gratis] sessão", error.message);
            return setFalha({ erro: "Não conseguimos abrir pelo link. Entre com o seu e-mail e a senha.", entrar: true });
          }
        }
        const r = await ativarTesteGratis();
        if (!r.ok) return setFalha(r);
        if (r.novo) {
          w.gtag?.("event", "sign_up", { method: "teste_gratis" });
          w.fbq?.("track", "CompleteRegistration");
          w.fbq?.("track", "StartTrial");
        }
        setPronto({ email: r.email, novo: r.novo });
      } catch (err) {
        console.error("[teste-gratis]", err);
        setFalha({ erro: "Não conseguimos abrir o seu acesso agora. Atualize a página.", entrar: true });
      }
    })();
  }, []);

  if (pronto) {
    return (
      <div className={CARTAO} role="status">
        <p className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#2fbf9f]/15 text-[28px] font-bold text-[#1f9a80]">✓</p>
        <h1 className="mt-3 text-[22px] font-extrabold">Deu tudo certo!</h1>
        <p className="mt-2 text-[14px] text-[#5d5770]">
          E-mail confirmado e acesso liberado. <strong className="text-[#0e0e13]">Você já pode fechar esta página.</strong>
        </p>
        <p className="mt-3 rounded-xl bg-[#f3f1fb] px-4 py-3 text-[13px] text-[#4a4458]">
          Para entrar quando quiser: <strong>app.ivva.app.br/login</strong>
          <br />
          com <strong>{pronto.email}</strong> e a senha que você criou.
        </p>
        <a href={pronto.novo ? "/dashboard?boas-vindas=1" : "/dashboard"} className={BOTAO}>
          Entrar agora
        </a>
      </div>
    );
  }
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

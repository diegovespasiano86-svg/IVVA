"use client";

import { useEffect } from "react";
import { GlowBackdrop } from "./planos/brand-fx";
import IvvaLogo from "./planos/logo";

// Tela de erro inesperado, no padrão visual da ivva. O detalhe técnico fica só no console/servidor.
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ivva] erro na tela", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main
      className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0b0b10] px-4 text-center text-[#f7f6f2]"
      style={{ fontFamily: "var(--font-jakarta), system-ui, sans-serif" }}
    >
      <GlowBackdrop />
      <div className="mb-10">
        <IvvaLogo light />
      </div>
      <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-[#ff6b5b]">Algo saiu do previsto</p>
      <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.02em] sm:text-[38px]">Não conseguimos abrir esta tela</h1>
      <p className="mt-3 max-w-[460px] text-[15px] text-[#a5a3b0]">
        Já registramos o problema. Tente de novo; se continuar, fale com a gente e informe o código abaixo.
      </p>
      {error.digest && <p className="mt-3 rounded-full bg-white/5 px-3 py-1 text-[12px] text-[#8a8896]">Código: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)]"
        >
          Tentar de novo
        </button>
        <a
          href="/dashboard"
          className="rounded-full border border-white/15 px-6 py-3 text-[14px] font-semibold text-[#c7c5d1] hover:border-white/30 hover:text-[#f7f6f2]"
        >
          Ir para o início
        </a>
      </div>
    </main>
  );
}

import Link from "next/link";
import { GlowBackdrop } from "./planos/brand-fx";
import IvvaLogo from "./planos/logo";

// Página 404 no padrão visual da ivva (mesmo fundo escuro e marca dos planos).
export default function NotFound() {
  return (
    <main
      className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0b0b10] px-4 text-center text-[#f7f6f2]"
      style={{ fontFamily: "var(--font-jakarta), system-ui, sans-serif" }}
    >
      <GlowBackdrop />
      <div className="mb-10">
        <IvvaLogo light />
      </div>
      <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-[#2fbf9f]">Erro 404</p>
      <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.02em] sm:text-[38px]">Essa página não existe</h1>
      <p className="mt-3 max-w-[440px] text-[15px] text-[#a5a3b0]">
        O endereço pode ter mudado ou estar digitado errado. Volte para o início e continue de onde parou.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)]"
        >
          Ir para o início
        </Link>
        <a
          href="https://ivva.app.br/contato"
          className="rounded-full border border-white/15 px-6 py-3 text-[14px] font-semibold text-[#c7c5d1] hover:border-white/30 hover:text-[#f7f6f2]"
        >
          Falar com a gente
        </a>
      </div>
    </main>
  );
}

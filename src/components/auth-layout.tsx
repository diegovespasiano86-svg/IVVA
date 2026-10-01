import { CalendarCheck, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";

/** Estrutura das telas de acesso (login, recuperar senha...): painel da marca + formulário. */
export default function AuthLayout({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ---- painel da marca (desktop) ---- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0b0b10] p-12 text-white lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(139,127,232,0.55),transparent_65%)] float-slow" />
          <div className="absolute -bottom-32 -left-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(47,191,159,0.4),transparent_65%)] float-slow [animation-direction:reverse]" />
          <div className="absolute bottom-24 right-10 h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(255,107,91,0.28),transparent_65%)] float-slow" />
        </div>

        <div className="relative z-10">
          <Logo tone="light" />
        </div>

        <div className="relative z-10 max-w-[480px]">
          <h2 className="text-[40px] font-extrabold leading-[1.08] tracking-[-0.02em]">
            Sua recepção <span className="font-accent text-gradient pr-1 text-[46px]">sempre viva.</span>
          </h2>
          <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-white/70">
            A ivva atende, agenda e vende pelo WhatsApp enquanto você cuida do que importa.
          </p>

          <div className="mt-9 max-w-[400px] rounded-2xl border border-white/15 bg-[#0e0e13]/70 p-4 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <div className="flex flex-col gap-2 text-[13px]">
              <p className="max-w-[78%] self-start rounded-2xl rounded-tl-sm bg-white/10 px-3.5 py-2">Oi! Tem horário amanhã de manhã?</p>
              <p className="max-w-[78%] self-end rounded-2xl rounded-tr-sm bg-[#6d5be0] px-3.5 py-2">Tenho 9h30 ou 10h. Qual fica melhor pra você?</p>
              <p className="max-w-[78%] self-start rounded-2xl rounded-tl-sm bg-white/10 px-3.5 py-2">10h!</p>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#2fbf9f]/15 px-3 py-2 text-[12.5px] font-bold text-[#6ee7c8]">
              <CalendarCheck size={15} /> Agendado · amanhã, 10h
            </div>
          </div>
        </div>

        <p className="relative z-10 flex items-center gap-2 text-[12.5px] text-white/55">
          <ShieldCheck size={15} /> API oficial do WhatsApp · Seus dados protegidos
        </p>
      </aside>

      {/* ---- formulário ---- */}
      <section className="flex flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 w-full max-w-[420px] rounded-2xl bg-[#0b0b10] px-5 py-4 lg:hidden">
          <Logo tone="light" />
          <p className="mt-1.5 text-[12.5px] text-white/65">
            Sua recepção <span className="font-accent text-gradient pr-0.5 text-[15px]">sempre viva.</span>
          </p>
        </div>
        <div className="w-full max-w-[420px]">
          <div className="card p-8 shadow-[0_24px_60px_-30px_rgba(20,18,27,0.35)] md:p-10">{children}</div>
          {footer && <div className="mt-6 text-center text-[12.5px] text-ink-faint">{footer}</div>}
        </div>
      </section>
    </main>
  );
}

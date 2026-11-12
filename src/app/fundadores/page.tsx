import type { Metadata } from "next";
import Image from "next/image";
import { GlowBackdrop } from "../planos/brand-fx";
import IvvaLogo from "../planos/logo";
import MetaSelo, { MetaShield } from "@/components/meta-seal";
import FundadoresClient from "./fundadores-client";
import { FUNDADORES, REGRAS_INDICACAO_FUNDADORES, REGRAS_PROGRAMA } from "./regras";

export const metadata: Metadata = {
  title: "Fundadores da ivva · 3 meses por nossa conta",
  description: "Convite exclusivo para os primeiros parceiros da ivva: plano Profissional sem custo até 12/02/2027.",
  robots: { index: false, follow: false },
};

const GRADIENTE = "bg-[linear-gradient(95deg,#2fbf9f_0%,#8b7fe8_55%,#ff6b5b_100%)]";
const SERIF = { fontFamily: "var(--font-instrument-serif), Georgia, serif" } as const;

const LINHA_DO_TEMPO = [
  { quando: "Hoje", titulo: "Você entra", texto: "Cadastra o cartão (R$ 0,00) e o acesso ao plano Profissional é liberado." },
  { quando: "Até 12/02", titulo: "3 meses por nossa conta", texto: "Usa tudo, conta com a nossa equipe e nos diz o que melhorar." },
  { quando: "12/02/2027", titulo: "Último dia para cancelar", texto: "Não quer continuar? Cancele até esta data e nada é cobrado." },
  { quando: "13/02/2027", titulo: "Começa a mensalidade", texto: `R$ ${FUNDADORES.precoMensal},00 por mês no cartão. Com indicações, até R$ 300,00 a menos.` },
];

const INCLUI = [
  "Atendimento no WhatsApp 24h, em texto e voz",
  "Agenda, cobrança e confirmação automáticas",
  "Sugestões de complemento para vender mais",
  "Retorno de clientes que sumiram",
  "Suporte direto com o fundador, sem fila",
];

export default function FundadoresPage() {
  return (
    <main className="relative isolate overflow-hidden px-4 pb-24 pt-8">
      <GlowBackdrop />

      <div className="relative mx-auto max-w-[1100px]">
        <div className="mb-10 flex items-center justify-between gap-4">
          <IvvaLogo light />
          <a href="/login" className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold text-[#c7c5d1] transition-colors hover:border-white/30 hover:text-[#f7f6f2]">
            Entrar
          </a>
        </div>

        {/* Abertura */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="inline-flex rounded-full border border-[#2fbf9f]/40 bg-[#2fbf9f]/10 px-3.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#2fbf9f]">
              Convite exclusivo · Fundadores
            </p>
            <h1 className="mt-5 text-[38px] font-extrabold leading-[1.04] tracking-[-0.03em] text-balance sm:text-[56px]">
              Demorou, mas{" "}
              <span className={`${GRADIENTE} bg-clip-text italic text-transparent`} style={SERIF}>
                chegou.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#c7c5d1] text-balance">
              A ivva foi aprovada pela Meta para usar a API oficial do WhatsApp Business, e você é um dos primeiros a entrar. Por isso o plano{" "}
              <strong className="text-[#f7f6f2]">{FUNDADORES.nomePlano}</strong> fica sem custo por 3 meses, até {FUNDADORES.ultimoDiaCancelar}.
            </p>
            <div className="mt-6">
              <MetaSelo />
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#entrar" className={`${GRADIENTE} rounded-full px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)]`}>
                Quero ser Fundador
              </a>
              <a href="#regras" className="rounded-full border border-white/15 px-5 py-3 text-[14px] font-semibold text-[#c7c5d1] hover:border-white/30 hover:text-[#f7f6f2]">
                Ver as regras
              </a>
            </div>
          </div>

          {/* Fundador, em translúcido */}
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[400px] overflow-hidden rounded-[2rem] border border-white/10">
            <Image
              src="/fundador-diego.jpg"
              alt="Diego Vespasiano, fundador da ivva"
              fill
              priority
              sizes="(max-width: 1024px) 90vw, 400px"
              className="object-cover opacity-60"
              style={{ maskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(47,191,159,0.18),rgba(139,127,232,0.28)_55%,rgba(11,11,16,0.85))]" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-[15px] font-extrabold">Diego Vespasiano</p>
              <p className="text-[12.5px] text-[#c7c5d1]">Fundador da ivva</p>
            </div>
          </div>
        </section>

        {/* Palavra do fundador */}
        <section className="mt-16 rounded-3xl border border-white/10 bg-white/[0.04] p-7 sm:p-10">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#a5a3b0]">Uma palavra do fundador</p>
          <blockquote className="mt-4 max-w-3xl text-[19px] leading-relaxed text-[#f7f6f2] sm:text-[22px]">
            <span className={`${GRADIENTE} bg-clip-text italic text-transparent`} style={SERIF}>
              “Estudei os maiores sistemas de atendimento do Brasil e dos Estados Unidos e ouvi amigos empresários reclamarem da mesma coisa: o chatbot responde, mas não cuida do negócio.
              Nenhum deles me pareceu completo. Criei a ivva para ser o parceiro do seu negócio: atende, agenda, vende e traz o cliente de volta.
              Você está entre os primeiros a acreditar nisso, e eu não esqueço quem esteve aqui no começo. Conto com você nessa jornada, rumo a uma parceria de longo prazo.”
            </span>
          </blockquote>
          <p className="mt-5 text-[14px] font-bold">Diego Vespasiano</p>
          <p className="text-[12.5px] text-[#a5a3b0]">Fundador da ivva</p>
        </section>

        {/* Oferta e como funciona */}
        <section className="mt-16">
          <h2 className="text-[28px] font-extrabold tracking-[-0.02em] sm:text-[34px]">
            Como funciona,{" "}
            <span className={`${GRADIENTE} bg-clip-text italic text-transparent`} style={SERIF}>
              sem surpresa
            </span>
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-4">
            {LINHA_DO_TEMPO.map((p, i) => (
              <li key={p.titulo} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#6d5be0] text-[13px] font-extrabold">{i + 1}</span>
                <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#2fbf9f]">{p.quando}</p>
                <p className="mt-1 text-[15px] font-extrabold">{p.titulo}</p>
                <p className="mt-1.5 text-[13px] leading-snug text-[#a5a3b0]">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#2fbf9f]">Plano {FUNDADORES.nomePlano}</p>
            <p className="mt-2 text-[40px] font-extrabold leading-none tracking-[-0.03em]">R$ 0,00</p>
            <p className="mt-1 text-[13px] text-[#a5a3b0]">até {FUNDADORES.ultimoDiaCancelar} · depois R$ {FUNDADORES.precoMensal},00/mês</p>
            <ul className="mt-5 space-y-2.5 text-[14px] text-[#e4e1ec]">
              {INCLUI.map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2fbf9f]/20 text-[#2fbf9f]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-[#8b7fe8]/40 bg-[linear-gradient(160deg,rgba(139,127,232,0.18),rgba(47,191,159,0.08))] p-7">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#a99cfa]">Parceiros indicam, parceiros ganham</p>
            <p className="mt-2 text-[40px] font-extrabold leading-none tracking-[-0.03em]">R$ {FUNDADORES.descontoIndicacao},00 a menos</p>
            <p className="mt-1 text-[13px] text-[#c7c5d1]">em cada mensalidade, por cada cliente pagante que você indicar, a partir de fevereiro.</p>
            <p className="mt-5 text-[14px] leading-relaxed text-[#e4e1ec]">
              Indicou um amigo que assinou? Sua mensalidade cai R$ {FUNDADORES.descontoIndicacao},00. Indicou dois? Cai R$ {FUNDADORES.descontoIndicacao * 2},00.
              O desconto dura enquanto eles continuarem como clientes.
            </p>
          </div>
        </section>

        {/* Meta */}
        <section className="mt-12 flex flex-col items-center gap-6 rounded-3xl border border-[#2fbf9f]/30 bg-[#0e0e13] px-6 py-9 text-center md:flex-row md:text-left">
          <MetaShield size={96} />
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#2fbf9f]">Aprovação oficial</p>
            <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] sm:text-[26px]">Aprovada pela Meta para usar a API oficial do WhatsApp Business</h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#a5a3b0]">
              Análise do app aprovada em novembro de 2026 e empresa verificada. Seus clientes falam com a ivva pelo canal oficial, sem risco de bloqueio do número.
            </p>
          </div>
        </section>

        {/* Cadastro */}
        <section id="entrar" className="mt-16 scroll-mt-8">
          <div className="mb-8 text-center">
            <h2 className="text-[28px] font-extrabold tracking-[-0.02em] sm:text-[34px]">
              Seu lugar entre os{" "}
              <span className={`${GRADIENTE} bg-clip-text italic text-transparent`} style={SERIF}>
                Fundadores
              </span>
            </h2>
            <p className="mt-2 text-[14.5px] text-[#a5a3b0]">Cadastre-se e cadastre o cartão. Hoje você paga R$ 0,00.</p>
          </div>
          <FundadoresClient />
        </section>

        {/* Regras */}
        <section id="regras" className="mx-auto mt-16 max-w-3xl scroll-mt-8">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Regras do programa</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-[#c7c5d1] marker:text-[#2fbf9f]">
            {REGRAS_PROGRAMA.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <h2 className="mt-10 text-[22px] font-extrabold tracking-[-0.02em]">Regras da indicação: R$ {FUNDADORES.descontoIndicacao},00 por indicado</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-[#c7c5d1] marker:text-[#8b7fe8]">
            {REGRAS_INDICACAO_FUNDADORES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <p className="mt-8 text-center text-[12.5px] text-[#8a8896]">
            Dúvidas? Fale direto com o fundador pelo WhatsApp de suporte da ivva.
          </p>
        </section>
      </div>
    </main>
  );
}

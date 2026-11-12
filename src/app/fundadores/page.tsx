import type { Metadata } from "next";
import Image from "next/image";
import IvvaLogo, { WaveMark, WAVE_PATH } from "../planos/logo";
import MetaSelo, { MetaShield } from "@/components/meta-seal";
import FundadoresClient from "./fundadores-client";
import { FUNDADORES, REGRAS_INDICACAO_FUNDADORES, REGRAS_PROGRAMA } from "./regras";

export const metadata: Metadata = {
  title: "Fundadores da ivva · 3 meses por nossa conta",
  description: "Convite exclusivo para os primeiros parceiros da ivva: plano Completo sem custo até 12/02/2027.",
  robots: { index: false, follow: false },
};

const GRADIENTE = "bg-[linear-gradient(95deg,#2fbf9f_0%,#8b7fe8_55%,#ff6b5b_100%)]";
const SERIF = { fontFamily: "var(--font-instrument-serif), Georgia, serif" } as const;

const CSS = `
@keyframes fund-draw { 0% { stroke-dashoffset: 1; opacity: 1; } 55% { stroke-dashoffset: 0; opacity: 1; } 88% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes fund-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes fund-aurora { 0%, 100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(50px,-34px,0) scale(1.18); } }
@keyframes fund-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes fund-shine { from { transform: translateX(-130%) skewX(-18deg); } to { transform: translateX(420%) skewX(-18deg); } }
.fund-draw { stroke-dasharray: 1; animation: fund-draw 9s ease-in-out infinite; }
.fund-marquee { animation: fund-marquee 38s linear infinite; }
.fund-aurora { animation: fund-aurora 14s ease-in-out infinite; }
.fund-float { animation: fund-float 6s ease-in-out infinite; }
.fund-btn { position: relative; overflow: hidden; }
.fund-btn::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 28%; background: linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent); animation: fund-shine 3.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .fund-draw, .fund-marquee, .fund-aurora, .fund-float, .fund-btn::after { animation: none; } .fund-draw { stroke-dashoffset: 0; } }
`;

const FAIXA = [
  "Atende 24h em texto e voz",
  "Gateway de pagamentos",
  "Campanhas com um botão",
  "Traz o cliente de volta",
  "Histórico dos últimos 6 meses",
  "Agenda e cobra o sinal",
  "Catálogo e estoque",
  "Aprovada pela Meta",
];

// Painel da hero: só o que o produto já faz hoje.
const PAINEL = [
  { titulo: "Atende por voz", texto: "Responde em áudio, 24h. Nenhum dos 4 sistemas que comparamos oferece.", cor: "#2fbf9f" },
  { titulo: "Gateway de pagamentos", texto: "Cobra Pix e cartão no WhatsApp, com Stripe, Asaas ou Mercado Pago.", cor: "#8b7fe8" },
  { titulo: "Campanhas", texto: "Dispara para a sua base com um botão, com texto e horário que você escolhe.", cor: "#ff6b5b" },
  { titulo: "Traz o cliente de volta", texto: "Recall e reengajamento automáticos de quem sumiu.", cor: "#2fbf9f" },
  { titulo: "Histórico de 6 meses", texto: "Faturamento e avaliações mês a mês, nos últimos 6 meses.", cor: "#8b7fe8" },
  { titulo: "Catálogo e estoque", texto: "Serviços, produtos e estoque no mesmo sistema do atendimento.", cor: "#ff6b5b" },
];

const LINHA_DO_TEMPO = [
  { quando: "Hoje", titulo: "Você entra", texto: "Cadastra o cartão (R$ 0,00) e o acesso ao plano mais completo da ivva é liberado." },
  { quando: "Até 12/02", titulo: "3 meses por nossa conta", texto: "Usa tudo, conta com a nossa equipe e nos diz o que melhorar." },
  { quando: "12/02/2027", titulo: "Último dia para escolher", texto: "Cancele e nada é cobrado, ou troque para o plano que faz sentido para o seu negócio." },
  { quando: "13/02/2027", titulo: "Começa a mensalidade", texto: `Sem troca, segue no ${FUNDADORES.nomePlano}: R$ ${FUNDADORES.precoMensal},00 por mês no cartão. Cada indicação paga vale 1 mensalidade.` },
];

const DIFERENCIAIS = [
  { titulo: "Atende por voz", texto: "Responde em áudio. Nos quatro sistemas que comparamos, nenhum oferece.", cor: "#2fbf9f" },
  { titulo: "Catálogo e estoque", texto: "Serviços, produtos e estoque dentro do mesmo sistema do atendimento.", cor: "#8b7fe8" },
  { titulo: "O conjunto, não uma peça", texto: "Agenda, sinal, recall, campanhas, CRM e relatórios no mesmo lugar, com preço público.", cor: "#ff6b5b" },
];

const INCLUI = [
  "Atendimento no WhatsApp 24h, em texto e voz",
  "Agenda, cobrança e confirmação automáticas",
  "Sugestões de complemento para vender mais",
  "Retorno de clientes que sumiram",
  "Administração pelo WhatsApp, sinal antecipado e recibo automático",
  "Suporte direto com o fundador, sem fila",
];

function Faixa() {
  const itens = [...FAIXA, ...FAIXA];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-white/[0.03] py-3.5 backdrop-blur-sm" aria-hidden>
      <div className="fund-marquee flex w-max items-center gap-10 whitespace-nowrap">
        {[0, 1].map((k) => (
          <div key={k} className="flex items-center gap-10">
            {itens.map((t, i) => (
              <span key={`${k}-${i}`} className="flex items-center gap-3 text-[13.5px] font-semibold text-[#c7c5d1]">
                <WaveMark size={22} strokeWidth={9} />
                {t}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FundadoresPage() {
  return (
    <main className="relative isolate overflow-hidden pb-0">
      <style>{CSS}</style>

      {/* HERO: cabe na primeira tela */}
      <section className="relative isolate flex min-h-[calc(100svh-54px)] flex-col overflow-hidden px-4 pb-10 pt-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[#0b0b10]">
          <div className="fund-aurora absolute -left-40 top-10 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(47,191,159,0.42),transparent_65%)]" />
          <div className="fund-aurora absolute -right-32 -top-48 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(139,127,232,0.5),transparent_65%)]" style={{ animationDelay: "-5s" }} />
          <div className="fund-aurora absolute bottom-[-220px] left-1/3 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,107,91,0.3),transparent_65%)]" style={{ animationDelay: "-9s" }} />
          {/* a ondinha da ivva se desenhando */}
          <svg viewBox="0 0 96 100" fill="none" aria-hidden className="absolute -right-20 -top-6 h-[700px] w-[700px] opacity-70">
            <defs>
              <linearGradient id="fund-wave" x1="10" y1="20" x2="86" y2="80" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#2fbf9f" />
                <stop offset="0.55" stopColor="#8b7fe8" />
                <stop offset="1" stopColor="#ff6b5b" />
              </linearGradient>
              <filter id="fund-blur"><feGaussianBlur stdDeviation="2.2" /></filter>
            </defs>
            <path d={WAVE_PATH} pathLength={1} stroke="url(#fund-wave)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="fund-draw" filter="url(#fund-blur)" />
            <path d={WAVE_PATH} pathLength={1} stroke="url(#fund-wave)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" className="fund-draw" />
          </svg>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:28px_28px]" />
        </div>

        <div className="relative mx-auto flex w-full max-w-[1100px] flex-1 flex-col">
          <div className="mb-6 flex items-center justify-between gap-4">
            <IvvaLogo light />
            <a href="/login" className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold text-[#c7c5d1] transition-colors hover:border-white/30 hover:text-[#f7f6f2]">
              Entrar
            </a>
          </div>

          <div className="my-auto grid items-center gap-8 py-6 lg:grid-cols-[1fr_1fr] lg:gap-12">
            <div>
              <p className="inline-flex rounded-full border border-[#2fbf9f]/40 bg-[#2fbf9f]/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#2fbf9f]">
                Programa de parceiros fundadores
              </p>
              <h1 className="mt-4 text-[36px] font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-[clamp(48px,5.4vw,72px)]">
                Demorou, mas{" "}
                <span className={`${GRADIENTE} bg-clip-text italic text-transparent`} style={SERIF}>
                  chegou.
                </span>
              </h1>
              <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-[#c7c5d1] text-balance lg:text-[18px]">
                Não é robô. É a sua empresa, sempre viva. Aprovada pela Meta para usar a API oficial do WhatsApp Business, a ivva abre para você primeiro:{" "}
                <strong className="text-[#f7f6f2]">plano {FUNDADORES.nomePlano} por nossa conta até {FUNDADORES.ultimoDiaCancelar}</strong>.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a href="#entrar" className={`fund-btn ${GRADIENTE} rounded-full px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_14px_40px_-10px_rgba(139,127,232,0.8)]`}>
                  Quero ser Fundador
                </a>
                <a href="#regras" className="rounded-full border border-white/15 px-5 py-3 text-[14px] font-semibold text-[#c7c5d1] hover:border-white/30 hover:text-[#f7f6f2]">
                  Ver as regras
                </a>
              </div>
              <div className="mt-5">
                <MetaSelo />
              </div>
            </div>

            {/* Painel de pitch em vidro */}
            <div className="fund-float relative overflow-hidden rounded-[1.5rem] border border-white/[0.12] bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_30px_70px_-40px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-5 lg:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),transparent_38%,transparent_70%,rgba(139,127,232,0.1))]" />
              <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-[#a99cfa]">Só a ivva junta tudo isso</p>
              <ul className="relative mt-3 grid gap-2.5 sm:grid-cols-2 lg:mt-4 lg:gap-3">
                {PAINEL.map((d) => (
                  <li key={d.titulo} className="rounded-xl border border-white/[0.09] bg-white/[0.03] p-3 lg:p-4">
                    <p className="flex items-center gap-2 text-[13.5px] font-extrabold lg:text-[15px]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.cor, boxShadow: `0 0 12px ${d.cor}` }} />
                      {d.titulo}
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-[#b4b2c0] lg:text-[13px]">{d.texto}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Faixa />

      <div className="relative mx-auto max-w-[1100px] px-4 pb-24">
        {/* Como funciona */}
        <section className="mt-20">
          <h2 className="text-[28px] font-extrabold tracking-[-0.02em] sm:text-[36px]">
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

        {/* Pitch: peça x conjunto */}
        <section className="mt-16">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#2fbf9f]">Por que a ivva</p>
          <h2 className="mt-2 max-w-3xl text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-balance sm:text-[36px]">
            Os outros entregam uma peça.{" "}
            <span className={`${GRADIENTE} bg-clip-text italic text-transparent`} style={SERIF}>
              A ivva entrega o conjunto.
            </span>
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {DIFERENCIAIS.map((d) => (
              <div key={d.titulo} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6" style={{ borderTop: `4px solid ${d.cor}` }}>
                <h3 className="text-[19px] font-extrabold">{d.titulo}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#a5a3b0]">{d.texto}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-[#8a8896]">Comparativo com Frontzapp, Zendesk, RD Station e Leadster, em páginas públicas pesquisadas em outubro de 2026.</p>
        </section>

        {/* Oferta */}
        <section className="mt-16 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#2fbf9f]">Plano {FUNDADORES.nomePlano}</p>
            <p className="mt-2 text-[44px] font-extrabold leading-none tracking-[-0.03em]">R$ 0,00</p>
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
          <div className="rounded-3xl border border-[#2fbf9f]/40 bg-[linear-gradient(160deg,rgba(47,191,159,0.2),rgba(139,127,232,0.14))] p-7">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#2fbf9f]">Vocês foram escolhidos</p>
            <p className="mt-2 text-[40px] font-extrabold leading-none tracking-[-0.03em]">1 mensalidade</p>
            <p className="mt-1 text-[13px] text-[#c7c5d1]">por cada cliente que você indicar, até {FUNDADORES.maxIndicacoes} indicações.</p>
            <ol className="mt-5 space-y-3">
              {[
                ["Indique", "Um dono de negócio que ainda não é cliente."],
                ["Ele fecha", "Entra, termina o teste e paga a primeira mensalidade."],
                ["Você ganha", `1 mensalidade (R$ ${FUNDADORES.precoMensal},00) de crédito na sua assinatura.`],
              ].map(([t, d], i) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#14121b] text-[12.5px] font-extrabold text-[#2fbf9f]">{i + 1}</span>
                  <p className="text-[14px] leading-snug text-[#e4e1ec]"><strong className="text-[#f7f6f2]">{t}.</strong> {d}</p>
                </li>
              ))}
            </ol>
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
            <h2 className="text-[28px] font-extrabold tracking-[-0.02em] sm:text-[36px]">
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
          <h2 className="mt-10 text-[22px] font-extrabold tracking-[-0.02em]">Regras da indicação: 1 mensalidade por indicação</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-[#c7c5d1] marker:text-[#8b7fe8]">
            {REGRAS_INDICACAO_FUNDADORES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </section>
      </div>

      {/* FUNDADOR: foto translúcida da esquerda para a direita e a palavra dele à direita */}
      <section className="relative isolate overflow-hidden border-t border-white/10 bg-[#0b0b10]">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-full lg:w-[62%]">
          <Image
            src="/fundador-diego.jpg"
            alt="Diego Vespasiano, fundador da ivva"
            fill
            sizes="(max-width: 1024px) 100vw, 62vw"
            className="object-cover opacity-55"
            style={{
              objectPosition: "50% 18%",
              maskImage: "linear-gradient(to right, #000 25%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, #000 25%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)",
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(47,191,159,0.14),rgba(139,127,232,0.2)_55%,transparent)]" />
        </div>
        <div className="relative mx-auto flex min-h-[640px] max-w-[1100px] items-end px-4 py-16 lg:items-center lg:justify-end">
          <div className="w-full max-w-[520px] rounded-3xl border border-white/15 bg-[#0b0b10]/70 p-7 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-9">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#2fbf9f]">Uma palavra do fundador</p>
            <blockquote className="mt-4 text-[17px] leading-relaxed text-[#f7f6f2] sm:text-[18.5px]">
              <span className={`${GRADIENTE} bg-clip-text italic text-transparent`} style={SERIF}>
                “Estudei os maiores sistemas de atendimento do Brasil e dos Estados Unidos e ouvi amigos empresários reclamarem da mesma coisa: o chatbot responde, mas não cuida do negócio.
                Nenhum deles me pareceu completo. Criei a ivva para ser o parceiro do seu negócio: atende, agenda, vende e traz o cliente de volta.
                Você está entre os primeiros a acreditar nisso, e eu não esqueço quem esteve aqui no começo. Conto com você nessa jornada, rumo a uma parceria de longo prazo.”
              </span>
            </blockquote>
            <div className="mt-5 flex items-center gap-3">
              <WaveMark size={30} strokeWidth={9} />
              <div>
                <p className="text-[14.5px] font-extrabold">Diego Vespasiano</p>
                <p className="text-[12.5px] text-[#a5a3b0]">Fundador da ivva</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <p className="bg-[#0b0b10] px-4 py-8 text-center text-[12.5px] text-[#8a8896]">
        Dúvidas? Fale direto com o fundador pelo WhatsApp de suporte da ivva.
      </p>
    </main>
  );
}

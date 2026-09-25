import { FloatingPill, GlowBackdrop, HeroBackdrop, WaveWatermark } from "./brand-fx";
import IvvaLogo from "./logo";
import PlanosClient from "./planos-client";

const JAKARTA = { fontFamily: "var(--font-jakarta), system-ui, sans-serif" } as const;
const SERIF = { fontFamily: "var(--font-instrument-serif), Georgia, serif" } as const;

const PROVAS = [
  "API oficial do WhatsApp",
  "Configura conversando",
  "A partir de R$ 297/mês",
  "Sem fidelidade",
];

const PLANOS = [
  {
    key: "essencial",
    nome: "Essencial",
    preco: 297,
    descricao: "Atendimento e agenda no piloto automático.",
    recursos: [
      "Chatbot no WhatsApp 24h (1 número)",
      "1 calendário",
      "CRM com funil de vendas",
      "Dashboard com KPIs básicos",
      "Base de conhecimento pronta pro seu nicho",
      "Suporte padrão",
    ],
  },
  {
    key: "profissional",
    nome: "Profissional",
    preco: 447,
    descricao: "Pra equipe com mais de um profissional.",
    destaque: true,
    recursos: [
      "Tudo do Essencial",
      "Calendários múltiplos por profissional",
      "Comissão automática por profissional",
      "SAC e avaliações",
      "Reengajamento e recall automático",
      "Fila de espera inteligente",
      "Controle de estoque",
      "Resposta por áudio",
      "Cancelamento pelo próprio chat",
      "Suporte prioritário",
    ],
  },
  {
    key: "completo",
    nome: "Completo",
    preco: 597,
    descricao: "Operação inteira dentro do WhatsApp.",
    recursos: [
      "Tudo do Profissional",
      "Admin do negócio pelo WhatsApp",
      "Sinal antecipado (anti no-show)",
      "Recibo automático por WhatsApp",
      "Suporte prioritário",
    ],
  },
];

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[#2fbf9f]" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PlanosPage() {
  return (
    <main className="relative isolate overflow-hidden">
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative isolate flex min-h-[86svh] items-center overflow-hidden px-6 pt-10 pb-20">
        <HeroBackdrop />

        {/* a onda da marca atravessando o fundo */}
        <WaveWatermark
          className="left-1/2 top-1/2 h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2"
          opacity={0.14}
          strokeWidth={3.2}
          drift={5}
          duration={26}
        />
        <WaveWatermark
          className="-left-24 bottom-[-12%] h-[46vmin] w-[46vmin]"
          opacity={0.06}
          strokeWidth={5}
          drift={9}
          duration={34}
          delay={0.6}
        />

        {/* bolhas de conversa, como no hero do site */}
        <FloatingPill className="left-[4%] top-[30%]" delay={0.2}>
          Agendado ✅ Corte + barba, 16h
        </FloatingPill>
        <FloatingPill className="right-[5%] top-[24%]" delay={0.5}>
          Venda extra: + R$ 20
        </FloatingPill>
        <FloatingPill className="left-[8%] bottom-[20%]" delay={0.8}>
          Áudio entendido · 0:04
        </FloatingPill>
        <FloatingPill className="right-[7%] bottom-[26%]" delay={1.1}>
          Lembrete enviado 2h antes
        </FloatingPill>

        <div className="relative mx-auto w-full max-w-4xl">
          <div className="mb-10 flex items-center justify-between gap-4">
            <IvvaLogo light />
            <a
              href="/login"
              className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold text-[#c7c5d1] transition-colors hover:border-white/30 hover:text-[#f7f6f2]"
              style={JAKARTA}
            >
              Entrar
            </a>
          </div>

          <div className="text-center">
            <span
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[13px] font-medium text-[#c7c5d1] backdrop-blur-sm"
              style={JAKARTA}
            >
              <span className="h-2 w-2 rounded-full bg-[#2fbf9f]" />
              Preço público, sem &ldquo;fale com vendas&rdquo;
            </span>

            <h1
              className="mt-7 text-[38px] leading-[1.05] font-extrabold tracking-[-0.035em] text-balance text-[#f7f6f2] sm:text-[54px] lg:text-[62px]"
              style={JAKARTA}
            >
              Escolha o plano.
              <br />A sua empresa,{" "}
              <span
                className="bg-[linear-gradient(95deg,#2fbf9f_0%,#8b7fe8_55%,#ff6b5b_100%)] bg-clip-text italic text-transparent"
                style={SERIF}
              >
                sempre viva
              </span>
              .
            </h1>

            <p
              className="mx-auto mt-6 max-w-[54ch] text-[16px] leading-relaxed text-[#a5a3b0] sm:text-[17px]"
              style={JAKARTA}
            >
              14 dias grátis pra testar com os seus clientes de verdade. Cancela
              quando quiser, sem multa e sem ligação de retenção.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#planos"
                className="rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-7 py-3.5 text-[14.5px] font-semibold text-white shadow-[0_18px_45px_-14px_rgba(139,127,232,0.75)] transition-shadow hover:shadow-[0_22px_55px_-12px_rgba(139,127,232,0.9)]"
                style={JAKARTA}
              >
                Ver os planos ↓
              </a>
              <a
                href="https://ivva.app.br"
                className="rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-[14.5px] font-semibold text-[#f7f6f2] transition-colors hover:border-white/30 hover:bg-white/10"
                style={JAKARTA}
              >
                Ver como funciona
              </a>
            </div>

            <ul
              className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13.5px] text-[#a5a3b0]"
              style={JAKARTA}
            >
              {PROVAS.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Check />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- PLANOS */}
      <section id="planos" className="relative isolate scroll-mt-8 overflow-hidden bg-[#0b0b10] px-4 py-20 sm:py-24">
        <GlowBackdrop />

        <div className="relative mx-auto max-w-[1100px]">
          <div className="mb-12 text-center">
            <h2
              className="text-[27px] font-extrabold tracking-[-0.025em] text-balance text-[#f7f6f2] sm:text-[34px]"
              style={JAKARTA}
            >
              Três planos. O mesmo{" "}
              <span
                className="bg-[linear-gradient(95deg,#2fbf9f_0%,#8b7fe8_55%,#ff6b5b_100%)] bg-clip-text italic text-transparent"
                style={SERIF}
              >
                atendimento
              </span>{" "}
              por trás.
            </h2>
            <p className="mx-auto mt-3 max-w-[48ch] text-[15px] text-[#a5a3b0]" style={JAKARTA}>
              O que muda é o tamanho da operação: quantos profissionais, quanta
              automação e quanto do negócio roda sozinho.
            </p>
          </div>

          <PlanosClient planos={PLANOS} />

          <p className="mt-12 text-center text-[13px] text-[#8a8896]" style={JAKARTA}>
            Já tem conta?{" "}
            <a href="/login" className="font-semibold text-[#f7f6f2] hover:underline">
              Entrar
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

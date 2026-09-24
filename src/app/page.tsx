import Link from "next/link";

const RECURSOS = [
  {
    titulo: "Atendimento no WhatsApp 24h",
    descricao:
      "O robô responde na hora, com o jeito e as informações do seu negócio — de madrugada, fim de semana, feriado.",
    icon: "M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.5 8.5 0 0 1-3.8-.9L4 20l1-4.3A8.4 8.4 0 1 1 21 11.5Z",
  },
  {
    titulo: "Agenda automática",
    descricao:
      "Cliente marca, remarca e cancela direto no chat. Você só acompanha o calendário se encher.",
    icon: "M4 6h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM3 10h18M8 3v4M16 3v4",
  },
  {
    titulo: "CRM com funil de vendas",
    descricao:
      "Cada contato entra num funil — sem contato, 1ª conversa, 2ª conversa, fechamento. Você vê onde cada cliente está.",
    icon: "M2 20c1-3.5 3.5-5 7-5s6 1.5 7 5M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 13c2.8 0 5 1.5 6 5M17 8a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z",
  },
  {
    titulo: "Dashboard com métricas reais",
    descricao:
      "Faturamento do mês, conversas, agendamentos futuros — tudo em linguagem de dono de negócio, sem planilha.",
    icon: "M4 19V5M4 19h16M8 15v4M13 11v8M18 7v12",
  },
];

const NICHOS = [
  "Salão de beleza",
  "Barbearia",
  "Clínica de estética",
  "Odontologia",
  "Pet shop",
  "Academia",
  "Restaurante",
  "Petshop",
  "Advocacia",
  "Imobiliária",
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 34 34">
            <defs>
              <linearGradient id="lg-header" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2FBF9F" />
                <stop offset="0.55" stopColor="#8B7FE8" />
                <stop offset="1" stopColor="#FF6B5B" />
              </linearGradient>
            </defs>
            <rect width="34" height="34" rx="10" fill="url(#lg-header)" />
            <path
              d="M7 20c2 0 2.5-8 5-8s2 10 4.5 10 2.5-12 5-12 2 10 4.5 10"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-display text-[19px] font-extrabold lowercase tracking-tight">
            ivva
          </span>
        </div>
        <nav className="flex items-center gap-5">
          <Link
            href="/planos"
            className="text-[13.5px] font-semibold text-ink-soft hover:text-ink"
          >
            Planos
          </Link>
          <Link
            href="/login"
            className="btn bg-ink px-4 py-2.5 text-[13px] text-white"
          >
            Entrar
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-[820px] px-4 pb-16 pt-10 text-center sm:pt-16">
        <span className="mb-5 inline-block rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-ink-soft">
          Recepção com IA no WhatsApp
        </span>
        <h1 className="font-display text-[32px] font-extrabold text-balance sm:text-[44px]">
          Seu WhatsApp atende, agenda e vende — mesmo quando você não está.
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] text-ink-soft sm:text-[16px]">
          A ivva é a recepcionista de IA de negócios de serviço como o seu:
          responde cliente na hora, organiza a agenda e mantém o CRM
          atualizado sozinha — 24 horas por dia.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/planos"
            className="btn w-full bg-ink px-6 py-3.5 text-[14px] text-white sm:w-auto"
          >
            Ver planos e preços
          </Link>
          <Link
            href="/login"
            className="btn w-full border border-border bg-surface px-6 py-3.5 text-[14px] text-ink sm:w-auto"
          >
            Já sou cliente — Entrar
          </Link>
        </div>
        <p className="mt-4 text-[12.5px] text-ink-faint">
          14 dias grátis, sem cartão. Cancela quando quiser.
        </p>
      </section>

      <section className="mx-auto max-w-[1080px] px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RECURSOS.map((r) => (
            <div key={r.titulo} className="card px-5 py-6">
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-[10px]"
                style={{ background: "var(--surface-soft)" }}
              >
                <svg className="icon" viewBox="0 0 24 24" style={{ color: "var(--purple)" }}>
                  <path d={r.icon} />
                </svg>
              </div>
              <h3 className="text-[14.5px] font-bold">{r.titulo}</h3>
              <p className="mt-1.5 text-[13px] text-ink-soft">{r.descricao}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-4 pb-16 text-center">
        <p className="mb-4 text-[12.5px] font-bold uppercase tracking-wide text-ink-faint">
          Feito pro seu tipo de negócio
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {NICHOS.map((n) => (
            <span
              key={n}
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-soft"
            >
              {n}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[820px] px-4 pb-20">
        <div className="card flex flex-col items-center gap-4 px-6 py-10 text-center">
          <h2 className="font-display text-[22px] font-extrabold text-balance">
            Pronto pra tirar o atendimento das suas costas?
          </h2>
          <p className="max-w-[440px] text-[13.5px] text-ink-soft">
            Preço público, sem "fale com vendas". Configura em minutos e o
            robô já entra respondendo com o conhecimento do seu negócio.
          </p>
          <Link
            href="/planos"
            className="btn bg-ink px-6 py-3.5 text-[14px] text-white"
          >
            Ver planos e preços
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-[1080px] flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="font-display text-[14px] font-extrabold lowercase tracking-tight">
            ivva
          </span>
          <p className="text-[12px] text-ink-faint">
            © {new Date().getFullYear()} ivva. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}

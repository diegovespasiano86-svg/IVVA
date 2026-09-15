import PlanoForm from "./plano-form";

const PLANOS = [
  {
    key: "essencial",
    nome: "Essencial",
    preco: 297,
    descricao: "Atendimento e agenda no piloto automático.",
    recursos: [
      "Chatbot de agendamento 24h",
      "1 calendário",
      "Dashboard com KPIs básicos",
      "Checkout básico",
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
      "CRM com funil de vendas",
      "Comissão automática por profissional",
      "SAC e avaliações",
      "Tarefas de upsell/cross-sell",
      "Cancelamento pelo próprio chat",
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
      "Estoque de produtos",
      "Fila de espera inteligente",
      "Suporte prioritário",
    ],
  },
];

export default function PlanosPage() {
  return (
    <main className="min-h-screen px-4 py-14">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-10 text-center">
          <div className="mb-4 flex items-center justify-center gap-2.5">
            <svg width="30" height="30" viewBox="0 0 34 34">
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#2FBF9F" />
                  <stop offset="0.55" stopColor="#8B7FE8" />
                  <stop offset="1" stopColor="#FF6B5B" />
                </linearGradient>
              </defs>
              <rect width="34" height="34" rx="10" fill="url(#lg)" />
              <path
                d="M7 20c2 0 2.5-8 5-8s2 10 4.5 10 2.5-12 5-12 2 10 4.5 10"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-display text-[20px] font-extrabold lowercase tracking-tight">
              ivva
            </span>
          </div>
          <h1 className="font-display text-[28px] font-extrabold text-balance">
            Escolha o plano do seu negócio
          </h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            Preço público, sem "fale com vendas". 14 dias grátis, cancela
            quando quiser.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PLANOS.map((p) => (
            <div
              key={p.key}
              className={`card flex flex-col px-6 py-7 ${
                p.destaque ? "border-2 border-purple" : ""
              }`}
            >
              {p.destaque && (
                <span className="mb-3 w-fit rounded-full bg-purple/10 px-2.5 py-1 text-[11px] font-bold text-purple">
                  Mais escolhido
                </span>
              )}
              <h2 className="font-display text-[19px] font-extrabold">
                {p.nome}
              </h2>
              <p className="mt-1 text-[12.5px] text-ink-soft">
                {p.descricao}
              </p>
              <p className="mt-4 font-display text-[32px] font-extrabold">
                R$ {p.preco}
                <span className="text-[14px] font-semibold text-ink-faint">
                  /mês
                </span>
              </p>

              <ul className="mt-5 flex flex-1 flex-col gap-2">
                {p.recursos.map((r) => (
                  <li
                    key={r}
                    className="flex items-start gap-2 text-[13px] text-ink-soft"
                  >
                    <svg
                      className="icon mt-0.5 shrink-0"
                      viewBox="0 0 24 24"
                      style={{ color: "var(--teal)" }}
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {r}
                  </li>
                ))}
              </ul>

              <PlanoForm plano={p.key} destaque={p.destaque} />
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[12.5px] text-ink-faint">
          Já tem conta?{" "}
          <a href="/login" className="font-semibold text-ink">
            Entrar
          </a>
        </p>
      </div>
    </main>
  );
}

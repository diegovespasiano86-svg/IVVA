import IvvaLogo from "./logo";
import PlanoForm from "./plano-form";

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

export default function PlanosPage() {
  return (
    <main className="min-h-screen px-4 py-14">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-12 text-center">
          <div className="mb-6 flex items-center justify-center">
            <IvvaLogo />
          </div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-balance sm:text-[36px]">
            Escolha o{" "}
            <span
              className="bg-[linear-gradient(95deg,#2fbf9f_0%,#8b7fe8_55%,#ff6b5b_100%)] bg-clip-text italic text-transparent"
              style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}
            >
              plano
            </span>{" "}
            do seu negócio
          </h1>
          <p className="mt-3 text-[15px] text-[#6b6577]">
            Preço público, sem &ldquo;fale com vendas&rdquo;. 14 dias grátis, cancela
            quando quiser.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3 md:items-stretch">
          {PLANOS.map((p) => (
            <div
              key={p.key}
              id={p.key}
              className={`relative scroll-mt-24 rounded-3xl transition-shadow target:shadow-[0_20px_55px_-15px_rgba(139,127,232,0.55)] ${
                p.destaque
                  ? "bg-[linear-gradient(145deg,#2fbf9f,#8b7fe8_55%,#ff6b5b)] p-[2px] shadow-[0_40px_80px_-30px_rgba(139,127,232,0.7)]"
                  : "bg-[rgba(14,14,19,0.09)] p-px target:ring-2 target:ring-[#8b7fe8] target:ring-offset-2"
              }`}
            >
              <div
                className={`relative flex h-full flex-col rounded-[calc(1.5rem-2px)] p-7 ${
                  p.destaque ? "bg-[#0b0b10] text-[#f7f6f2]" : "bg-white"
                }`}
              >
                {p.destaque && (
                  <span className="absolute -top-3.5 left-7 rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-3 py-1 text-[11px] font-bold text-white shadow-lg">
                    Mais escolhido
                  </span>
                )}
                <h2 className="text-[19px] font-extrabold">{p.nome}</h2>
                <p className={`mt-1.5 text-[13px] ${p.destaque ? "text-[#a5a3b0]" : "text-[#6b6577]"}`}>
                  {p.descricao}
                </p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="text-sm font-semibold opacity-70">R$</span>
                  <span className="text-[38px] font-extrabold tracking-[-0.03em]">{p.preco}</span>
                  <span className={`text-[13px] ${p.destaque ? "text-[#a5a3b0]" : "text-[#8a8896]"}`}>
                    /mês
                  </span>
                </p>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {p.recursos.map((r) => (
                    <li
                      key={r}
                      className={`flex items-start gap-2.5 text-[13px] ${
                        p.destaque ? "text-[#c7c5d1]" : "text-[#6b6577]"
                      }`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-[#2fbf9f]">
                        <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {r}
                    </li>
                  ))}
                </ul>

                <PlanoForm plano={p.key} destaque={p.destaque} />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-[13px] text-[#8a8896]">
          Já tem conta?{" "}
          <a href="/login" className="font-semibold text-[#0e0e13] hover:underline">
            Entrar
          </a>
        </p>
      </div>
    </main>
  );
}

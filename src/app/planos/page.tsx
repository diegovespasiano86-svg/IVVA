import { GlowBackdrop } from "./brand-fx";
import IvvaLogo from "./logo";
import PlanosClient from "./planos-client";

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
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-10">
      <GlowBackdrop />

      <div className="relative mx-auto max-w-[1100px]">
        <div className="mb-10 flex items-center justify-between gap-4">
          <IvvaLogo light />
          <a
            href="/login"
            className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold text-[#c7c5d1] transition-colors hover:border-white/30 hover:text-[#f7f6f2]"
          >
            Entrar
          </a>
        </div>

        <div className="mb-12 text-center">
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
          <p className="mt-3 text-[15px] text-[#a5a3b0]">
            Preço público, sem &ldquo;fale com vendas&rdquo;. 14 dias grátis, cancela
            quando quiser.
          </p>
        </div>

        <PlanosClient planos={PLANOS} />

        <p className="mt-10 text-center text-[13px] text-[#8a8896]">
          Já tem conta?{" "}
          <a href="/login" className="font-semibold text-[#f7f6f2] hover:underline">
            Entrar
          </a>
        </p>
      </div>
    </main>
  );
}

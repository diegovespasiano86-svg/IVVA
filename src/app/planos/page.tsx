import { GlowBackdrop } from "./brand-fx";
import { redirect } from "next/navigation";
import MetaSelo from "@/components/meta-seal";
import IvvaLogo from "./logo";
import PlanosClient from "./planos-client";
import DemoViva from "./demo-viva";
import { pixAssinaturaConfigurada, pixAssinaturaLiberada } from "@/lib/asaas-ivva";
import { CONVITE_60, POLITICA_CANCELAMENTO, diasDeTeste, fimDoConvite60 } from "@/lib/planos";
import {
  CONVERSAS_POR_PLANO,
  PACOTE_AVULSO,
  RESPOSTAS_POR_CONVERSA_MEDIA,
  formatarNumero,
} from "@/lib/planos";

const PLANOS = [
  {
    key: "essencial",
    nome: "Essencial",
    preco: 297,
    conversas: CONVERSAS_POR_PLANO.essencial,
    descricao: "Atendimento e agenda no piloto automático.",
    recursos: [
      "Chatbot no WhatsApp 24h (1 número)",
      "1 calendário",
      "1 acesso (o seu)",
      "CRM com funil de vendas",
      "Dashboard com KPIs básicos",
      "Base de conhecimento pronta pro seu nicho",
      "Suporte pelo WhatsApp",
    ],
  },
  {
    key: "profissional",
    nome: "Profissional",
    preco: 447,
    conversas: CONVERSAS_POR_PLANO.profissional,
    descricao: "Pra equipe com mais de um profissional.",
    destaque: true,
    recursos: [
      "Tudo do Essencial",
      "Calendários múltiplos por profissional",
      "2 acessos, cada um com a sua agenda",
      "Comissão automática por profissional",
      "SAC e avaliações",
      "Reengajamento e recall automático",
      "Fila de espera inteligente",
      "Controle de estoque",
      "Resposta por áudio",
      "Cancelamento pelo próprio chat",
      "Suporte prioritário pelo WhatsApp",
    ],
  },
  {
    key: "completo",
    nome: "Completo",
    preco: 597,
    conversas: CONVERSAS_POR_PLANO.completo,
    descricao: "Operação inteira dentro do WhatsApp.",
    recursos: [
      "Tudo do Profissional",
      "Até 5 acessos, com agendas separadas e controle de administrador ou usuário",
      "Admin do negócio pelo WhatsApp",
      "Sinal antecipado (anti no-show)",
      "Recibo automático por WhatsApp",
      "Suporte prioritário pelo WhatsApp",
    ],
  },
];

export default async function PlanosPage(props: { searchParams: Promise<{ pix?: string; convite?: string }> }) {
  const { pix, convite } = await props.searchParams;
  // IVVA BLACK tem uma entrada só: o formulário da página de vendas (links antigos de convite também caem nele).
  if (convite === CONVITE_60.codigo) redirect("https://ivva.app.br/60-dias?f=convite#acesso");
  // Convite IVVA BLACK (lista /60-dias): mostra 60 dias em vez dos dias normais. A conferência da lista é no servidor, ao assinar.
  const convite60 = convite === CONVITE_60.codigo;
  const dias = convite60 ? CONVITE_60.dias : diasDeTeste();
  const primeiraCobranca = new Date(fimDoConvite60() * 1000).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  // Assinar no Pix: aparece para todos com ASAAS_IVVA_LIBERADO=1; antes disso, só em /planos?pix=teste.
  const pixVisivel = pixAssinaturaLiberada() || (pixAssinaturaConfigurada() && pix === "teste");

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
          {convite60 && (
            <div className="mx-auto mb-6 max-w-[640px] rounded-2xl border border-[#2fbf9f]/40 bg-[#2fbf9f]/10 px-5 py-4 text-left">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#2fbf9f]">Convite IVVA BLACK</p>
              <p className="mt-1 text-[16px] font-extrabold text-[#f7f6f2]">Seus 60 dias grátis estão garantidos 🎉</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[#c7c5d1]">
                Escolha o plano e cadastre o cartão: hoje você paga <strong className="text-[#f7f6f2]">R$ 0</strong>, e a
                primeira cobrança só acontece em <strong className="text-[#f7f6f2]">{primeiraCobranca}</strong>. Cancelando
                antes, nada é cobrado. Use o mesmo e-mail ou WhatsApp do seu cadastro na lista.
              </p>
            </div>
          )}
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
            Preço público, sem &ldquo;fale com vendas&rdquo;. {dias} dias grátis no cartão
            {pixVisivel && !convite60 ? " ou assinatura direto no Pix" : ""}, cancela quando quiser.
          </p>
        </div>

        <DemoViva />

        <PlanosClient planos={PLANOS} pixDisponivel={pixVisivel && !convite60} convite60={convite60} />

        <p className="mx-auto mt-8 max-w-[720px] text-center text-[12.5px] leading-relaxed text-[#8a8896]">
          Conversa = todas as respostas da IA para um mesmo cliente seu em até 24 horas (em média{" "}
          {RESPOSTAS_POR_CONVERSA_MEDIA} respostas). O limite renova todo mês, no dia 1º. Se ultrapassar o limite
          do mês, é possível comprar créditos avulsos: +{PACOTE_AVULSO.conversas} conversas por R${" "}
          {(PACOTE_AVULSO.valorCentavos / 100).toLocaleString("pt-BR")}, que não expiram e a IA continua
          atendendo na hora. Hoje: {formatarNumero(CONVERSAS_POR_PLANO.essencial)} /{" "}
          {formatarNumero(CONVERSAS_POR_PLANO.profissional)} / {formatarNumero(CONVERSAS_POR_PLANO.completo)}{" "}
          conversas por mês nos planos Essencial / Profissional / Completo.
        </p>

        <p className="mx-auto mt-4 max-w-[720px] text-center text-[12.5px] leading-relaxed text-[#8a8896]">
          {POLITICA_CANCELAMENTO}
        </p>

        <div className="mt-8 flex justify-center">
          <MetaSelo />
        </div>

        <p className="mt-6 text-center text-[13px] text-[#8a8896]">
          Já tem conta?{" "}
          <a href="/login" className="font-semibold text-[#f7f6f2] hover:underline">
            Entrar
          </a>
        </p>
      </div>
    </main>
  );
}

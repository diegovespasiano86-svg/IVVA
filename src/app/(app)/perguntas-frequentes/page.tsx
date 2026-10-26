import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import PageHeader from "@/components/page-header";
import { CONVERSAS_POR_PLANO, PACOTE_AVULSO, POLITICA_CANCELAMENTO, formatarNumero } from "@/lib/planos";

type Pergunta = { q: string; a: React.ReactNode };

const GRUPOS: { titulo: string; perguntas: Pergunta[] }[] = [
  {
    titulo: "Assinatura e pagamento",
    perguntas: [
      {
        q: "Como vejo meu plano, minhas faturas ou troco o cartão?",
        a: (
          <>
            Em <Link href="/assinatura">Minha assinatura</Link> (menu do seu nome, em Conta e assinatura). Lá ficam o plano, o valor, as faturas e o botão
            para trocar o cartão ou o plano.
          </>
        ),
      },
      {
        q: "Paguei no Pix. Como pago as próximas mensalidades?",
        a: "A cobrança Pix chega por e-mail antes de cada vencimento, e a mensalidade em aberto também aparece em Minha assinatura, com o botão para pagar. Sem pagamento, o acesso é suspenso 5 dias após o vencimento, sem apagar nada, e volta assim que o Pix é confirmado.",
      },
      {
        q: "Como funciona o cancelamento? Tem reembolso?",
        a: POLITICA_CANCELAMENTO,
      },
      {
        q: "Posso congelar o plano anual?",
        a: "Sim. Peça pelo e-mail contato@ivva.app.br. O tempo que faltava fica guardado e volta a contar quando você retomar. Não há reembolso do plano anual.",
      },
      {
        q: "Quando existe estorno?",
        a: "Em dois casos: arrependimento em até 7 dias da primeira contratação (devolução integral) ou cobrança feita por erro, como duplicidade. Fora disso, vale a política de cancelamento acima.",
      },
    ],
  },
  {
    titulo: "Conversas com a IA",
    perguntas: [
      {
        q: "Quantas conversas meu plano inclui?",
        a: `Essencial: ${formatarNumero(CONVERSAS_POR_PLANO.essencial)} por mês. Profissional: ${formatarNumero(CONVERSAS_POR_PLANO.profissional)}. Completo: ${formatarNumero(CONVERSAS_POR_PLANO.completo)}. Uma conversa reúne todas as respostas da IA a um mesmo cliente em até 24 horas. O limite renova todo dia 1º e não acumula.`,
      },
      {
        q: "E se as conversas acabarem antes do fim do mês?",
        a: `Você recebe avisos em 80%, 90% e 100%. Dá para comprar ${PACOTE_AVULSO.conversas} conversas avulsas, que não expiram e são usadas depois das do plano. Sem conversas, a IA para de responder e as mensagens passam para a sua equipe.`,
      },
      {
        q: "A IA pode errar?",
        a: "Pode. Ela responde com base no que está cadastrado na Base de conhecimento, no Catálogo e nas regras do Robô. Mantenha preços e políticas atualizados e acompanhe as conversas pela tela Conversas.",
      },
    ],
  },
  {
    titulo: "WhatsApp e atendimento",
    perguntas: [
      {
        q: "Por que meu WhatsApp ainda não conecta?",
        a: "A conexão oficial depende de aprovação da Meta (dona do WhatsApp). Enquanto isso, você pode testar o robô pelo simulador em Robô e deixar tudo configurado.",
      },
      {
        q: "Como passo um cliente para a minha equipe?",
        a: "Na tela Conversas, abra a conversa e assuma o atendimento. O robô também passa sozinho quando o cliente pede um humano ou quando o assunto está nas regras de passagem do Robô.",
      },
    ],
  },
  {
    titulo: "Suporte, contrato e dados",
    perguntas: [
      {
        q: "Em quanto tempo o suporte responde?",
        a: "Em dias úteis, das 9h às 18h. Primeira resposta em até 8 horas úteis quando o sistema ou o robô está parado, até 24 horas úteis quando um recurso importante falha e até 48 horas úteis para dúvidas e ajustes.",
      },
      {
        q: "Onde está o contrato que aceitei?",
        a: (
          <>
            Em <Link href="/politicas">Políticas e privacidade</Link>, no menu do seu nome. Lá aparecem o contrato completo e a data do seu aceite.
          </>
        ),
      },
      {
        q: "Meus dados e os dos meus clientes estão seguros?",
        a: "Cada negócio só enxerga os próprios dados, a conexão é criptografada e os acessos ficam registrados. Os dados não são vendidos nem usados para treinar IA de terceiros. Pedidos sobre dados pessoais: contato@ivva.app.br.",
      },
    ],
  },
];

export default function PerguntasFrequentesPage() {
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader
        icon={MessageCircleQuestion}
        title="Perguntas frequentes"
        subtitle={
          <>
            Não achou sua resposta? Veja os vídeos em <Link href="/ajuda" className="font-semibold text-purple underline underline-offset-2">Aprender</Link> ou escreva para
            contato@ivva.app.br.
          </>
        }
      />
      <div className="space-y-4">
        {GRUPOS.map((g) => (
          <section key={g.titulo} className="card p-5">
            <h2 className="text-[15px] font-bold">{g.titulo}</h2>
            <div className="mt-2 divide-y divide-border">
              {g.perguntas.map((p) => (
                <details key={p.q} className="group py-3">
                  <summary className="cursor-pointer list-none text-[14px] font-semibold text-ink marker:hidden">
                    <span className="mr-2 inline-block text-purple transition-transform group-open:rotate-90">›</span>
                    {p.q}
                  </summary>
                  <div className="mt-2 pl-5 text-[13.5px] leading-relaxed text-ink-soft [&_a]:font-semibold [&_a]:text-purple [&_a]:underline">{p.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

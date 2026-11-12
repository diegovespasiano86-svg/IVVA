// Programa Fundadores da ivva: tudo que a página e a cobrança dizem vem daqui, para nunca divergir.
export const FUNDADORES = {
  plano: "completo",
  nomePlano: "Completo",
  precoMensal: 597,
  /** Último dia para cancelar sem custo. */
  ultimoDiaCancelar: "12/02/2027",
  /** A Stripe cobra a 1ª mensalidade neste instante (meia-noite de Brasília do dia 13/02/2027). */
  trialEnd: Math.floor(Date.parse("2027-02-13T00:00:00-03:00") / 1000),
  primeiraCobranca: "13/02/2027",
  /** Mesmo programa da apresentação aos clientes (13/10): 1 mensalidade por indicação, até 12 indicações. */
  maxIndicacoes: 12,
} as const;

export const MENSAGEM_PAGAMENTO = `Programa Fundadores: R$ 0,00 hoje e até ${FUNDADORES.ultimoDiaCancelar}. Se você não cancelar até ${FUNDADORES.ultimoDiaCancelar}, o cartão será cobrado em ${FUNDADORES.primeiraCobranca} (R$ ${FUNDADORES.precoMensal},00 por mês, plano ${FUNDADORES.nomePlano}) e a cada mês depois disso. Cancele quando quiser em app.ivva.app.br, em Conta.`;

export const REGRAS_INDICACAO_FUNDADORES = [
  `Cada cliente novo que você indicar e que se tornar pagante vale 1 mensalidade do seu plano (R$ ${FUNDADORES.precoMensal},00 no ${FUNDADORES.nomePlano}, ou o valor do plano que você escolher), concedida como crédito na sua assinatura.`,
  `Você pode ganhar até ${FUNDADORES.maxIndicacoes} mensalidades, uma por indicação.`,
  "Vale para quem ainda não tem conta na ivva e assina pelo seu link de indicação, que você encontra no app, ou que você apresenta à ivva por escrito antes de ele assinar.",
  "O indicado vira pagante quando o teste grátis dele termina e a 1ª mensalidade é paga. O crédito é liberado quando esse pagamento é confirmado e a assinatura dele continua ativa depois de 30 dias.",
  "O crédito abate as próximas cobranças da sua assinatura. Se sobrar, abate as seguintes. Ele não vira dinheiro nem é pago em espécie.",
  "Se o indicado cancelar ou pedir estorno dentro desses 30 dias, o crédito daquela indicação não é concedido.",
  "Não vale indicar a si mesmo, nem alguém que já tenha conta na ivva. Cada pessoa indicada conta uma única vez.",
  "Este benefício substitui o Indique e ganhe padrão da ivva para os Fundadores; os dois não se somam.",
  "A ivva pode recusar indicações com indício de fraude e pode ajustar as regras para novas indicações, avisando por escrito com 30 dias de antecedência.",
];

export const REGRAS_PROGRAMA = [
  `Programa Fundadores: plano ${FUNDADORES.nomePlano} sem custo de hoje até ${FUNDADORES.ultimoDiaCancelar}, para quem se cadastra por esta página.`,
  "O cadastro do cartão é obrigatório para ativar o acesso, mas nada é cobrado durante o período gratuito.",
  `Para não ser cobrado, cancele até ${FUNDADORES.ultimoDiaCancelar}, em app.ivva.app.br (Minha assinatura) ou pelo WhatsApp de suporte. Sem cancelamento, a 1ª mensalidade de R$ ${FUNDADORES.precoMensal},00 é cobrada em ${FUNDADORES.primeiraCobranca}.`,
  "Depois disso, a mensalidade é cobrada todo mês no mesmo cartão, até você cancelar. O acesso segue ativo até o fim do período já pago.",
  "Durante o período gratuito você usa o plano Completo, o mais alto da ivva. Até 12/02/2027 você pode trocar para o plano que fizer mais sentido (Essencial ou Profissional) em app.ivva.app.br, em Minha assinatura > Trocar de plano; sem troca, a assinatura segue no Completo. Os valores são os de tabela e podem ser reajustados, com aviso por escrito de 30 dias.",
  "Vale o Contrato de Prestação de Serviços, os Termos de Uso e a Política de Privacidade da ivva. Fica preservado o direito de arrependimento de 7 dias previsto em lei.",
  "O comparativo com outros sistemas usa páginas públicas pesquisadas em outubro de 2026 (Frontzapp, Zendesk, RD Station e Leadster) e pode mudar.",
  "Recursos marcados como em breve, como o ivva Estúdio, estão em desenvolvimento, sem data confirmada, e não fazem parte do que é contratado neste programa.",
  "A ivva é uma solução independente. Meta e WhatsApp são marcas de seus respectivos titulares.",
];

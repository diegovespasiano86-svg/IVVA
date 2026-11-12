// Programa Fundadores da ivva: tudo que a página e a cobrança dizem vem daqui, para nunca divergir.
export const FUNDADORES = {
  plano: "profissional",
  nomePlano: "Profissional",
  precoMensal: 447,
  /** Último dia para cancelar sem custo. */
  ultimoDiaCancelar: "12/02/2027",
  /** A Stripe cobra a 1ª mensalidade neste instante (meia-noite de Brasília do dia 13/02/2027). */
  trialEnd: Math.floor(Date.parse("2027-02-13T00:00:00-03:00") / 1000),
  primeiraCobranca: "13/02/2027",
  descontoIndicacao: 150,
  maxIndicadosComDesconto: 2,
} as const;

export const MENSAGEM_PAGAMENTO = `Programa Fundadores: R$ 0,00 hoje e até ${FUNDADORES.ultimoDiaCancelar}. Se você não cancelar até ${FUNDADORES.ultimoDiaCancelar}, o cartão será cobrado em ${FUNDADORES.primeiraCobranca} (R$ ${FUNDADORES.precoMensal},00 por mês, plano ${FUNDADORES.nomePlano}) e a cada mês depois disso. Cancele quando quiser em app.ivva.app.br, em Conta.`;

export const REGRAS_INDICACAO_FUNDADORES = [
  `Cada cliente novo que você indicar e que se tornar pagante dá R$ ${FUNDADORES.descontoIndicacao},00 de desconto em cada mensalidade sua, a partir de fevereiro de 2027.`,
  `O desconto vale para até ${FUNDADORES.maxIndicadosComDesconto} indicados pagantes ao mesmo tempo (até R$ ${FUNDADORES.descontoIndicacao * FUNDADORES.maxIndicadosComDesconto},00 por mês).`,
  "Vale para quem ainda não tem conta na ivva e assina pelo seu link de indicação, que você encontra no app, ou que você apresenta à ivva por escrito antes de ele assinar.",
  "O indicado vira pagante quando o teste grátis dele termina e a 1ª mensalidade é paga. O desconto entra na mensalidade seguinte a esse pagamento.",
  "O desconto dura enquanto o indicado continuar pagando. Se ele cancelar ou atrasar, o desconto daquela indicação sai nas mensalidades seguintes.",
  "O desconto abate a sua mensalidade e nunca gera dinheiro de volta nem crédito acima do valor da fatura.",
  "Não vale indicar a si mesmo, nem alguém que já tenha conta na ivva. Cada pessoa indicada conta uma única vez.",
  "Este benefício substitui o Indique e ganhe padrão da ivva para os Fundadores; os dois não se somam.",
  "A ivva pode recusar indicações com indício de fraude e pode ajustar as regras para novos indicados, avisando por escrito com 30 dias de antecedência.",
];

export const REGRAS_PROGRAMA = [
  `Programa Fundadores: plano ${FUNDADORES.nomePlano} sem custo de hoje até ${FUNDADORES.ultimoDiaCancelar}, para quem se cadastra por esta página.`,
  "O cadastro do cartão é obrigatório para ativar o acesso, mas nada é cobrado durante o período gratuito.",
  `Para não ser cobrado, cancele até ${FUNDADORES.ultimoDiaCancelar}, em app.ivva.app.br (Conta) ou pelo WhatsApp de suporte. Sem cancelamento, a 1ª mensalidade de R$ ${FUNDADORES.precoMensal},00 é cobrada em ${FUNDADORES.primeiraCobranca}.`,
  "Depois disso, a mensalidade é cobrada todo mês no mesmo cartão, até você cancelar. O acesso segue ativo até o fim do período já pago.",
  "O valor do plano Profissional é o de tabela e pode ser reajustado, com aviso por escrito de 30 dias.",
  "Vale o Contrato de Prestação de Serviços, os Termos de Uso e a Política de Privacidade da ivva. Fica preservado o direito de arrependimento de 7 dias previsto em lei.",
  "A ivva é uma solução independente. Meta e WhatsApp são marcas de seus respectivos titulares.",
];

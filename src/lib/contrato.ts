// Contrato de prestação de serviços e termos de uso da ivva. Fonte única do popup de aceite
// e da página /contrato. Ao mudar o texto, troque CONTRATO_VERSAO: todos aceitam de novo.
import { POLITICA_CANCELAMENTO } from "@/lib/planos";

export const CONTRATO_VERSAO = "2026-10-26";
export const CONTRATO_ATUALIZADO = "26/10/2026";

const EMPRESA = "69.262.496 DIEGO VESPASIANO DOS SANTOS, CNPJ 69.262.496/0001-78";
const EMAIL = "contato@ivva.app.br";

export type Clausula = { titulo: string; paragrafos?: string[]; itens?: string[] };

export const CONTRATO: Clausula[] = [
  {
    titulo: "1. Partes e objeto",
    paragrafos: [
      `Este contrato é feito entre a ivva (${EMPRESA}), chamada aqui de IVVA, e a pessoa ou empresa que assina um plano, chamada de CONTRATANTE, incluindo os usuários que ela convida para a conta.`,
      "O objeto é o uso da plataforma ivva: atendente com inteligência artificial para WhatsApp, agenda, CRM, catálogo, cobranças, relatórios e demais recursos do plano contratado, acessados pela internet.",
    ],
  },
  {
    titulo: "2. Planos, pagamento e renovação",
    itens: [
      "Os valores e o que cada plano inclui são os publicados na página de preços no momento da contratação.",
      "No cartão, o plano começa com 14 dias grátis e depois é cobrado automaticamente a cada período (mensal ou anual).",
      "No Pix, não há teste grátis: o primeiro período é pago na contratação e as cobranças seguintes chegam por e-mail antes de cada vencimento.",
      "Sem pagamento, o acesso é suspenso 5 dias após o vencimento, sem apagar os dados, e volta assim que o pagamento é confirmado.",
      "As conversas com a IA incluídas no plano renovam todo mês e não acumulam. Créditos avulsos comprados não expiram.",
      "Reajustes de preço são avisados com pelo menos 30 dias de antecedência e valem a partir do período seguinte.",
    ],
  },
  {
    titulo: "3. Cancelamento, reembolso e estorno",
    paragrafos: [POLITICA_CANCELAMENTO],
    itens: [
      "O cancelamento pode ser feito a qualquer momento, sem multa e sem fidelidade.",
      "Não há reembolso proporcional (pro-rata) do período já pago. O acesso continua até o fim do período contratado.",
      "No plano anual, a assinatura pode ser congelada e retomada depois; o tempo restante fica guardado. Não há reembolso do plano anual.",
      "Estorno só acontece em dois casos: direito de arrependimento em até 7 dias da primeira contratação (Código de Defesa do Consumidor, art. 49), com devolução integral, ou cobrança feita por erro, como duplicidade.",
      "Créditos avulsos de conversas já usados não são reembolsados.",
      "Contestar uma cobrança devida diretamente no cartão ou no banco (chargeback), sem antes falar com a IVVA, leva à suspensão da conta até a regularização.",
    ],
  },
  {
    titulo: "4. Regras de uso do sistema",
    itens: [
      "Usar a plataforma apenas para atender e vender aos clientes do próprio negócio, de forma lícita.",
      "Seguir as políticas da Meta e do WhatsApp Business. É proibido enviar spam, mensagens em massa para quem não autorizou e conteúdo enganoso, ofensivo, discriminatório ou ilegal.",
      "Manter corretas as informações da base de conhecimento, do catálogo e dos preços. A IA responde com base nelas.",
      "Não compartilhar login e senha. Cada pessoa da equipe deve ter o próprio acesso, criado por convite.",
      "Não tentar copiar, descompilar, testar a segurança, sobrecarregar ou burlar limites da plataforma, nem usar robôs ou scripts para extrair dados dela.",
      "Informar aos seus clientes, quando aplicável, que o atendimento usa assistente virtual.",
    ],
  },
  {
    titulo: "5. Uso por concorrentes e propriedade intelectual",
    itens: [
      "A plataforma, a marca, as telas, os textos, os fluxos, as instruções da IA, os vídeos e a documentação pertencem à IVVA. A contratação dá apenas uma licença de uso, pessoal e intransferível, enquanto o plano estiver ativo.",
      "É proibido contratar ou usar a ivva para análise competitiva, comparação de mercado (benchmarking), cópia ou reprodução de funcionalidades, telas, textos, fluxos ou instruções, ou para desenvolver produto ou serviço concorrente.",
      "Empresas e pessoas que desenvolvem, revendem ou prestam consultoria em soluções de atendimento automatizado, chatbots ou CRM só podem contratar com autorização prévia e por escrito da IVVA.",
      "Informações não públicas a que o CONTRATANTE tiver acesso (como funcionamento interno, preços negociados e roteiros) são confidenciais, durante e depois do contrato.",
      "A violação desta cláusula permite à IVVA encerrar a conta imediatamente, sem reembolso, sem prejuízo de cobrar perdas e danos.",
    ],
  },
  {
    titulo: "6. Proteção de dados (LGPD)",
    itens: [
      "A IVVA trata dados pessoais de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018) e com a Política de Privacidade publicada em ivva.app.br/privacidade.",
      "Sobre os dados dos clientes do CONTRATANTE (conversas, contatos, agendamentos, vendas), o CONTRATANTE é o controlador e a IVVA é a operadora: trata esses dados apenas para prestar o serviço, conforme as configurações e instruções do CONTRATANTE.",
      "O CONTRATANTE é responsável por ter base legal para tratar os dados dos seus clientes e por atender os pedidos deles (acesso, correção, exclusão), com o apoio da IVVA quando necessário.",
      "A IVVA usa fornecedores para operar o serviço, como hospedagem e banco de dados, Meta (WhatsApp e Instagram), provedores de inteligência artificial, meios de pagamento (Stripe, Asaas, Mercado Pago) e envio de e-mail. Eles recebem apenas o necessário para a sua função.",
      "Os dados ficam protegidos por controle de acesso por negócio, criptografia em trânsito e registro de acessos. Incidentes de segurança que possam causar risco ou dano relevante são comunicados ao CONTRATANTE sem demora injustificada.",
      "Os dados do CONTRATANTE não são vendidos nem usados para treinar modelos de IA de terceiros.",
      `Ao fim do contrato, o CONTRATANTE pode pedir a exportação dos seus dados. Depois disso, eles são excluídos ou anonimizados, salvo o que a lei obrigar a guardar. Contato do encarregado de dados: ${EMAIL}.`,
    ],
  },
  {
    titulo: "7. Atendimento e suporte",
    paragrafos: [
      `O suporte é feito pela Central de Ajuda dentro do sistema (botão "Precisa de ajuda?") e pelo e-mail ${EMAIL}, em dias úteis, das 9h às 18h (horário de Brasília). O prazo de primeira resposta é de até 48 horas úteis, conforme a necessidade:`,
    ],
    itens: [
      "Crítica (sistema fora do ar ou robô parado para todos os clientes): primeira resposta em até 8 horas úteis.",
      "Alta (um recurso importante não funciona e não há alternativa): primeira resposta em até 24 horas úteis.",
      "Normal (dúvidas, ajustes, configuração e sugestões): primeira resposta em até 48 horas úteis.",
      "O prazo é de primeira resposta. O tempo de solução depende do caso e, quando envolve terceiros (como a Meta), também do prazo deles.",
      "Ajustes de configuração feitos pela equipe IVVA a pedido do CONTRATANTE são feitos conforme a disponibilidade e podem ter custo quando fora do que o plano inclui.",
    ],
  },
  {
    titulo: "8. Disponibilidade e serviços de terceiros",
    itens: [
      "A IVVA trabalha para manter a plataforma disponível 24 horas por dia, 7 dias por semana, mas não garante funcionamento sem interrupções.",
      "Manutenções programadas são feitas preferencialmente fora do horário comercial e, quando possível, avisadas antes.",
      "A conexão com o WhatsApp depende da Meta. Bloqueios, limites, mudanças de regra ou instabilidade da Meta, de operadoras e de meios de pagamento não são de responsabilidade da IVVA.",
    ],
  },
  {
    titulo: "9. Inteligência artificial",
    itens: [
      "A IA responde com base nas informações, regras e catálogo cadastrados pelo CONTRATANTE e pode cometer erros. Cabe ao CONTRATANTE revisar as configurações e acompanhar as conversas.",
      "A ivva não substitui orientação profissional (médica, jurídica, financeira ou outra). O CONTRATANTE deve configurar a passagem para a equipe humana nos assuntos que exigem isso.",
    ],
  },
  {
    titulo: "10. Responsabilidade",
    itens: [
      "A IVVA responde por danos diretos comprovadamente causados pela plataforma, limitados ao valor pago pelo CONTRATANTE nos 12 meses anteriores ao fato.",
      "A IVVA não responde por lucros cessantes, perda de vendas ou danos indiretos, nem por conteúdo, preços e promessas cadastrados pelo CONTRATANTE.",
      "Esses limites não se aplicam quando a lei, inclusive o Código de Defesa do Consumidor, determinar o contrário.",
    ],
  },
  {
    titulo: "11. Suspensão e encerramento",
    itens: [
      "A IVVA pode suspender ou encerrar a conta em caso de falta de pagamento, violação deste contrato, uso ilegal ou risco à segurança da plataforma ou de terceiros, com aviso sempre que possível.",
      "O CONTRATANTE pode encerrar o contrato a qualquer momento cancelando a assinatura, conforme a cláusula 3.",
    ],
  },
  {
    titulo: "12. Alterações e disposições gerais",
    itens: [
      "Este contrato pode ser atualizado. Mudanças relevantes são avisadas no sistema e por e-mail, e a nova versão é apresentada para aceite no acesso seguinte.",
      "O aceite eletrônico, registrado com data, hora e dados do acesso, tem a mesma validade de uma assinatura.",
      "Fica eleito o foro da comarca de São Paulo/SP, salvo quando a lei garantir ao CONTRATANTE o foro do seu domicílio.",
    ],
  },
];

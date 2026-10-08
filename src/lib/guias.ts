// Guias por tela (Ajuda). Cada guia pode ter um vídeo: quando existir o arquivo, é só preencher `video`
// (ex.: "/ajuda/robo.mp4", colocando o arquivo em /public/ajuda/). Sem vídeo, mostra "Vídeo em breve".

export type Guia = {
  id: string;
  titulo: string;
  href: string;
  resumo: string;
  passos: string[];
  video?: string;
  soDono?: boolean;
};

export const GUIAS: Guia[] = [
  {
    id: "inicio",
    titulo: "Início",
    href: "/dashboard",
    resumo: "O resultado do mês e o que o robô fez por você, em linguagem de dono de negócio.",
    passos: [
      "Veja conversas, contatos, agendamentos e faturamento do mês nos cartões do topo.",
      "Acompanhe os gráficos de atendimentos, serviços mais pedidos e funil do CRM.",
      "Siga o checklist de primeiros passos até o robô estar no ar.",
    ],
  },
  {
    id: "conversas",
    titulo: "Conversas",
    href: "/conversas",
    resumo: "A caixa de atendimento do WhatsApp, com o robô e a sua equipe no mesmo lugar.",
    passos: [
      "Abra uma conversa para ver o histórico completo do cliente.",
      "Quando o robô chamar você, a conversa aparece em “Precisam de você”: responda e devolva ao robô quando quiser.",
      "Use o Monitor do robô para ver, quase em tempo real, o que ele está fazendo.",
    ],
  },
  {
    id: "clientes",
    titulo: "Clientes e CRM",
    href: "/crm",
    resumo: "Cada cliente vira um cartão no funil, com histórico, etiquetas e tarefas.",
    passos: [
      "Arraste os cartões entre as fases do funil conforme a venda avança.",
      "Use “Editar fases do funil” para renomear, reordenar ou criar as suas etapas.",
      "Crie etiquetas e listas para separar públicos e usar nas campanhas.",
    ],
  },
  {
    id: "campanhas",
    titulo: "Campanhas e automações",
    href: "/campanhas",
    resumo: "Envie mensagens para quem aceitou receber e deixe lembretes e pós-venda no automático.",
    passos: [
      "Escolha o modelo da mensagem e o público (lista ou etiqueta).",
      "Confira o resumo antes de enviar e acompanhe os resultados depois.",
      "Em Automações, ligue lembrete, pós-venda, reengajamento, aniversário e fila de espera.",
    ],
    soDono: true,
  },
  {
    id: "agenda",
    titulo: "Agenda",
    href: "/calendario",
    resumo: "Os horários marcados por você e pelo robô, por profissional.",
    passos: [
      "Veja o calendário do dia, da semana ou do mês.",
      "O que o robô marca aparece sozinho, sem conflito de horário.",
      "Use as tarefas para lembretes de upsell e cross-sell.",
    ],
  },
  {
    id: "checkout",
    titulo: "Checkout",
    href: "/checkout",
    resumo: "Monte a venda, gere o Pix e envie o link de pagamento pelo WhatsApp.",
    passos: [
      "Cadastre a chave Pix do seu negócio em Checkout (uma vez só).",
      "Monte o carrinho com serviços e produtos e gere o Pix copia e cola.",
      "Envie para o cliente pelo WhatsApp e acompanhe o pagamento.",
    ],
    soDono: true,
  },
  {
    id: "catalogo",
    titulo: "Catálogo e estoque",
    href: "/catalogo",
    resumo: "Seus serviços, produtos e pacotes. O estoque é opcional e só vale para produtos.",
    passos: [
      "Cadastre cada serviço ou produto com preço e duração.",
      "Para produtos, ligue o controle de estoque e defina o mínimo para receber alertas.",
      "Use “Análise e compras” para ver o que está acabando e quanto comprar.",
    ],
  },
  {
    id: "robo",
    titulo: "Robô (IA)",
    href: "/robo",
    resumo: "Personalidade, regras, base de conhecimento e o simulador para testar antes de atender de verdade.",
    passos: [
      "Em Base de conhecimento, escreva, suba um arquivo, fale ou use “Ler meu site” para ensinar o robô.",
      "Em “Calibrar o robô”, teste perguntas típicas no simulador. Se uma resposta sair errada, clique em 👎 e escreva a certa.",
      "Ajuste a personalidade e as regras que o robô deve seguir.",
    ],
    soDono: true,
  },
  {
    id: "relatorios",
    titulo: "Relatórios",
    href: "/relatorios",
    resumo: "Números por período: resultado da IA, atendimento, financeiro, clientes e avaliações.",
    passos: [
      "Escolha a aba e o período que quer analisar.",
      "Exporte para CSV ou Excel, ou imprima.",
      "Toda segunda-feira você também recebe um resumo da semana por e-mail.",
    ],
    soDono: true,
  },
  {
    id: "canais",
    titulo: "Canais (WhatsApp)",
    href: "/canais",
    resumo: "Conecte o WhatsApp do seu negócio pela API oficial da Meta.",
    passos: [
      "Siga o passo a passo para conectar o número do seu negócio.",
      "Escolha se quer usar o app do WhatsApp Business junto com a ivva ou só a ivva.",
      "Se a conexão cair, o sistema avisa no topo e você reconecta por aqui.",
    ],
    soDono: true,
  },
  {
    id: "conta",
    titulo: "Conta e equipe",
    href: "/conta",
    resumo: "Equipe, nomes que você usa no painel, uso de conversas e assinatura.",
    passos: [
      "Convide profissionais como administrador ou usuário.",
      "Em “Como você chama as coisas”, troque os nomes (cliente, paciente, aluno…) para o jeito do seu negócio.",
      "Acompanhe o uso de conversas do mês e compre conversas extras se precisar.",
    ],
    soDono: true,
  },
];

// Guias por tela (Ajuda). Cada guia pode ter um vídeo: quando existir o arquivo, é só preencher `video`
// (ex.: "/ajuda/robo.mp4", colocando o arquivo em /public/ajuda/). Sem vídeo, mostra "Vídeo em breve".

export type Guia = {
  id: string;
  titulo: string;
  href: string;
  resumo: string;
  passos: string[];
  video?: string;
  /** imagem de capa do vídeo (mesmo nome, .jpg) */
  poster?: string;
  /** duração mostrada no cartão, ex.: "0:21" */
  duracao?: string;
  /** palavras que a pessoa pode digitar na busca e que não estão no título */
  palavras?: string[];
  soDono?: boolean;
};

export const GUIAS: Guia[] = [
  {
    id: "inicio",
    video: "/ajuda/inicio.mp4",
    poster: "/ajuda/inicio.jpg",
    duracao: "0:53",
    palavras: ["resultado","painel","dashboard","números","primeiros passos"],
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
    video: "/ajuda/conversas.mp4",
    poster: "/ajuda/conversas.jpg",
    duracao: "0:21",
    palavras: ["whatsapp","atendimento","humano","assumir","monitor","mensagem"],
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
    video: "/ajuda/crm.mp4",
    poster: "/ajuda/crm.jpg",
    duracao: "0:17",
    palavras: ["crm","funil","contatos","etapas","tarefas","importar"],
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
    video: "/ajuda/campanhas.mp4",
    poster: "/ajuda/campanhas.jpg",
    duracao: "0:15",
    palavras: ["disparo","mensagem em massa","promoção","reengajamento"],
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
    video: "/ajuda/agenda.mp4",
    poster: "/ajuda/agenda.jpg",
    duracao: "0:19",
    palavras: ["horário","agendar","remarcar","cancelar","profissional","calendário"],
    titulo: "Agenda",
    href: "/calendario",
    resumo: "Os horários marcados por você e pelo robô, por profissional.",
    passos: [
      "Veja o calendário do dia, da semana ou do mês.",
      "O que o robô marca aparece sozinho, sem conflito de horário.",
      "Use “Oportunidades” para lembretes de upsell e cross-sell.",
    ],
  },
  {
    id: "checkout",
    video: "/ajuda/checkout.mp4",
    poster: "/ajuda/checkout.jpg",
    duracao: "0:34",
    palavras: ["pagamento","pix","venda","recibo","estorno","comissão"],
    titulo: "Checkout",
    href: "/checkout",
    resumo: "Monte a venda, registre o pagamento ou cobre por Pix e link direto da tela.",
    passos: [
      "Escolha o cliente e o profissional, e adicione os itens do catálogo (ou um item avulso).",
      "Escolha Pix, crédito, débito ou dinheiro e clique em “Registrar pagamento”.",
      "Para cobrar à distância, conecte o Asaas em Integrações e use “Cobrar pelo Asaas” (QR Code ou link): a venda é registrada sozinha quando o cliente paga.",
    ],
    soDono: true,
  },
  {
    id: "catalogo",
    video: "/ajuda/catalogo.mp4",
    poster: "/ajuda/catalogo.jpg",
    duracao: "0:21",
    palavras: ["estoque","produto","serviço","insumo","compras","preço"],
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
    id: "base-conhecimento",
    video: "/ajuda/base-conhecimento.mp4",
    poster: "/ajuda/base-conhecimento.jpg",
    duracao: "0:25",
    titulo: "Base de conhecimento",
    href: "/base-conhecimento",
    resumo: "Ensine o robô sobre o seu negócio: preços, horários, regras e serviços.",
    passos: [
      "Escreva uma informação por vez, suba um arquivo (.csv, PDF ou Word) ou grave um áudio.",
      "Ou cole o endereço do seu site em “Ler meu site”: a ivva sugere os itens e você revisa antes de salvar.",
      "Quanto mais completa a base, melhor o robô responde.",
    ],
    soDono: true,
    palavras: ["ensinar", "treinar", "preço", "preços", "horário", "site", "arquivo", "áudio", "pdf", "perguntas"],
  },
  {
    id: "calibrar",
    video: "/ajuda/calibrar.mp4",
    poster: "/ajuda/calibrar.jpg",
    duracao: "0:23",
    titulo: "Calibrar o robô",
    href: "/robo/simulador",
    resumo: "Teste o robô como se fosse o seu cliente e corrija as respostas erradas.",
    passos: [
      "No simulador, faça as perguntas que seus clientes mais fazem.",
      "Se uma resposta sair errada, clique em 👎 e escreva como ele deveria responder.",
      "Salve na base de conhecimento: o robô aprende na hora.",
    ],
    soDono: true,
    palavras: ["testar", "simulador", "corrigir", "errado", "resposta", "polegar", "treinar"],
  },
  {
    id: "indique",
    video: "/ajuda/indique.mp4",
    poster: "/ajuda/indique.jpg",
    duracao: "0:20",
    titulo: "Indique e ganhe",
    href: "/indique",
    resumo: "Indique a ivva e pague menos na sua mensalidade.",
    passos: [
      "Copie o seu link de indicação.",
      "Cada negócio que assinar um plano mensal pelo seu link e continuar ativo depois de 30 dias dá R$ 150 de desconto na sua mensalidade seguinte.",
    ],
    soDono: true,
    palavras: ["desconto", "indicação", "link", "crédito", "mensalidade", "amigo"],
  },
  {
    id: "robo",
    video: "/ajuda/robo.mp4",
    poster: "/ajuda/robo.jpg",
    duracao: "0:34",
    palavras: ["ia","personalidade","regras","assistente","tom de voz"],
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
    video: "/ajuda/relatorios.mp4",
    poster: "/ajuda/relatorios.jpg",
    duracao: "0:18",
    palavras: ["números","exportar","excel","csv","resumo semanal","faturamento"],
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
    video: "/ajuda/canais.mp4",
    poster: "/ajuda/canais.jpg",
    duracao: "0:20",
    palavras: ["whatsapp","conectar","meta","api","número","conexão"],
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
    video: "/ajuda/conta.mp4",
    poster: "/ajuda/conta.jpg",
    duracao: "0:34",
    palavras: ["equipe","senha","assinatura","plano","fatura","nomes","convidar","cartão"],
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

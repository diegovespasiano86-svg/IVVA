// Tipos de acesso de quem é convidado para a equipe. O texto daqui aparece no formulário de convite,
// no e-mail e na página do convite, para a pessoa (e o administrador) saberem o que cada acesso permite.
// As regras de verdade vivem em nav.ts (telas), middleware (rotas) e nas políticas do banco.

export type PapelConvite = "profissional" | "dono";

export const ACESSOS: Record<
  PapelConvite,
  { rotulo: string; resumo: string; pode: string[]; naoPode: string[] }
> = {
  profissional: {
    rotulo: "Usuário",
    resumo:
      "Usa o sistema no dia a dia: consulta e atende, sem mexer nas configurações do negócio.",
    pode: [
      "Ver a agenda e marcar, remarcar ou cancelar os próprios horários",
      "Responder clientes na caixa de atendimento quando o robô para, e consultar o SAC",
      "Cadastrar e consultar os próprios contatos no CRM, com anotações e funil",
      "Ajustar a quantidade do estoque",
      "Registrar pagamentos no checkout",
    ],
    naoPode: [
      "Criar ou alterar preços, serviços, produtos, colunas do funil, etiquetas e listas",
      "Mexer no robô, na base de conhecimento, em campanhas, no WhatsApp, em relatórios ou no plano",
      "Convidar pessoas ou apagar contatos",
    ],
  },
  dono: {
    rotulo: "Administrador",
    resumo: "Acesso total ao negócio, igual ao do dono. Dê só a quem você confia.",
    pode: [
      "Tudo que o usuário faz, com todos os contatos e agendas do negócio",
      "Criar e editar preços, serviços, produtos, colunas e fases do funil, etiquetas e listas",
      "Configurar o robô, a base de conhecimento, campanhas, automações e o WhatsApp",
      "Ver relatórios e faturamento, e convidar ou retirar pessoas da equipe",
      "Gerenciar o plano e os créditos, inclusive apagar a conta",
    ],
    naoPode: [],
  },
};

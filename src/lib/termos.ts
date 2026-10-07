// Vocabulário por nicho: o sistema é genérico, mas cada negócio chama as coisas de um jeito
// (paciente, aluno, tutor; corretor, dentista, instrutor; visita, consulta, aula; imóvel, procedimento, plano).
// Todos os substantivos ficam capitalizados; nas frases, use .toLowerCase().

export type Termos = {
  cliente: string;
  clientes: string;
  profissional: string;
  profissionais: string;
  agendamento: string;
  agendamentos: string;
  servico: string;
  servicos: string;
  /** Item de venda (produto) */
  produto: string;
  produtos: string;
  /** Ex.: "Visitas futuras", "Agendamentos futuros" (concordância já resolvida). */
  agendamentosFuturos: string;
};

const BASE: Omit<Termos, "agendamentosFuturos"> = {
  cliente: "Cliente",
  clientes: "Clientes",
  profissional: "Profissional",
  profissionais: "Profissionais",
  agendamento: "Agendamento",
  agendamentos: "Agendamentos",
  servico: "Serviço",
  servicos: "Serviços",
  produto: "Produto",
  produtos: "Produtos",
};

const POR_SEGMENTO: Record<string, Partial<Termos>> = {
  "clinica-estetica": { servico: "Procedimento", servicos: "Procedimentos" },
  odontologia: {
    cliente: "Paciente", clientes: "Pacientes",
    profissional: "Dentista", profissionais: "Dentistas",
    agendamento: "Consulta", agendamentos: "Consultas",
    servico: "Procedimento", servicos: "Procedimentos",
  },
  advocacia: {
    profissional: "Advogado", profissionais: "Advogados",
    agendamento: "Reunião", agendamentos: "Reuniões",
    servico: "Serviço jurídico", servicos: "Serviços jurídicos",
  },
  imoveis: {
    profissional: "Corretor", profissionais: "Corretores",
    agendamento: "Visita", agendamentos: "Visitas",
    servico: "Imóvel", servicos: "Imóveis",
  },
  comercio: {
    profissional: "Vendedor", profissionais: "Vendedores",
    agendamento: "Retirada", agendamentos: "Retiradas",
  },
  pet: {
    cliente: "Tutor", clientes: "Tutores",
    agendamento: "Atendimento", agendamentos: "Atendimentos",
  },
  academia: {
    cliente: "Aluno", clientes: "Alunos",
    profissional: "Instrutor", profissionais: "Instrutores",
    agendamento: "Aula", agendamentos: "Aulas",
    servico: "Aula ou plano", servicos: "Aulas e planos",
  },
  restaurante: {
    profissional: "Atendente", profissionais: "Atendentes",
    agendamento: "Reserva", agendamentos: "Reservas",
    servico: "Serviço", servicos: "Serviços",
    produto: "Prato", produtos: "Pratos",
  },
  "servicos-gerais": {
    profissional: "Técnico", profissionais: "Técnicos",
    agendamento: "Visita", agendamentos: "Visitas",
  },
  floricultura: {
    profissional: "Atendente", profissionais: "Atendentes",
    agendamento: "Encomenda", agendamentos: "Encomendas",
  },
};

export function termosDoSegmento(segmento: string | null | undefined): Termos {
  const t = { ...BASE, ...(POR_SEGMENTO[segmento ?? ""] ?? {}) };
  const feminino = !/o$/.test(t.agendamentos.replace(/s$/, "")) || t.agendamentos === "Reuniões";
  return { ...t, agendamentosFuturos: `${t.agendamentos} ${feminino ? "futuras" : "futuros"}` };
}

/** Troca os nomes fixos do menu pelo vocabulário do nicho. */
export function rotuloDoMenu(rotulo: string, t: Termos): string {
  const mapa: Record<string, string> = {
    Clientes: t.clientes,
    "Base de clientes": `Base de ${t.clientes.toLowerCase()}`,
    Calendário: "Calendário",
    "Catálogo e estoque": "Catálogo e estoque",
  };
  return mapa[rotulo] ?? rotulo;
}

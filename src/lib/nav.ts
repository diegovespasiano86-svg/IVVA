import {
  BarChart3,
  Bot,
  CalendarDays,
  Home,
  Megaphone,
  MessageSquare,
  Plug,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type Role = "dono" | "profissional";

export type NavLeaf = {
  href: string;
  label: string;
  roles: Role[];
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** vai pro rodapé do menu lateral */
  bottom?: boolean;
  items: NavLeaf[];
};

const AMBOS: Role[] = ["dono", "profissional"];
const DONO: Role[] = ["dono"];

// Estrutura de navegação. Só entram itens de telas que existem — novas
// telas (Campanhas, Canais, Relatórios...) entram aqui quando forem criadas.
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "inicio",
    label: "Início",
    icon: Home,
    items: [{ href: "/dashboard", label: "Início", roles: AMBOS }],
  },
  {
    id: "conversas",
    label: "Conversas",
    icon: MessageSquare,
    items: [
      { href: "/conversas", label: "Caixa de atendimento", roles: AMBOS },
      { href: "/conversas/monitor", label: "Monitor do robô", roles: AMBOS },
      { href: "/conversas/desempenho", label: "Desempenho", roles: DONO },
      { href: "/sac", label: "SAC", roles: AMBOS },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: Users,
    items: [
      { href: "/clientes", label: "Base de clientes", roles: DONO },
      { href: "/crm", label: "CRM + Funil de Vendas", roles: AMBOS },
      { href: "/clientes/etiquetas", label: "Etiquetas", roles: DONO },
      { href: "/clientes/listas", label: "Listas", roles: DONO },
      { href: "/avaliacoes", label: "Avaliações", roles: DONO },
    ],
  },
  {
    id: "campanhas",
    label: "Campanhas",
    icon: Megaphone,
    items: [
      { href: "/campanhas", label: "Disparos", roles: DONO },
      { href: "/campanhas/automacoes", label: "Automações", roles: DONO },
    ],
  },
  {
    id: "agenda",
    label: "Agenda",
    icon: CalendarDays,
    items: [
      { href: "/calendario", label: "Calendário", roles: AMBOS },
      { href: "/tarefas", label: "Tarefas", roles: DONO },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    items: [
      { href: "/checkout", label: "Checkout", roles: AMBOS },
      { href: "/faturamento", label: "Faturamento e comissões", roles: DONO },
      { href: "/estoque", label: "Estoque", roles: AMBOS },
    ],
  },
  {
    id: "robo",
    label: "Robô (IA)",
    icon: Bot,
    items: [
      { href: "/robo", label: "Personalidade e regras", roles: DONO },
      { href: "/base-conhecimento", label: "Base de conhecimento", roles: DONO },
      { href: "/robo/simulador", label: "Simulador", roles: DONO },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: BarChart3,
    items: [{ href: "/relatorios", label: "Relatórios e exportação", roles: DONO }],
  },
  {
    id: "canais",
    label: "Canais",
    icon: Plug,
    items: [{ href: "/canais", label: "WhatsApp e canais", roles: DONO }],
  },
  {
    id: "config",
    label: "Configurações",
    icon: Settings,
    bottom: true,
    items: [{ href: "/conta", label: "Conta e assinatura", roles: DONO }],
  },
];

/** Grupos com só os itens que o perfil pode ver (grupos vazios somem). */
export function navGroupsForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

/**
 * Trava de rotas no servidor (usada pelo middleware): o menu esconde o que o perfil não vê, mas
 * quem digita o endereço também precisa ser barrado. Vale o item de menu mais específico que
 * casa com o caminho (ex.: /conversas libera, /conversas/desempenho é só do dono). Caminho que
 * não casa com nenhum item e não é /dashboard fica restrito ao dono (inclui /admin).
 */
export function rotaPermitida(role: Role, pathname: string): boolean {
  if (role === "dono") return true;
  let melhor: NavLeaf | null = null;
  for (const grupo of NAV_GROUPS) {
    for (const item of grupo.items) {
      const casa = pathname === item.href || pathname.startsWith(item.href + "/");
      if (casa && (!melhor || item.href.length > melhor.href.length)) melhor = item;
    }
  }
  return melhor ? melhor.roles.includes(role) : false;
}

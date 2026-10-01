import {
  Bot,
  CalendarDays,
  Home,
  MessageSquare,
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
      { href: "/sac", label: "SAC", roles: AMBOS },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: Users,
    items: [
      { href: "/crm", label: "Base de clientes e funil", roles: DONO },
      { href: "/avaliacoes", label: "Avaliações", roles: AMBOS },
    ],
  },
  {
    id: "agenda",
    label: "Agenda",
    icon: CalendarDays,
    items: [
      { href: "/calendario", label: "Calendário", roles: AMBOS },
      { href: "/tarefas", label: "Tarefas", roles: AMBOS },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    items: [
      { href: "/checkout", label: "Checkout", roles: AMBOS },
      { href: "/faturamento", label: "Faturamento e comissões", roles: DONO },
      { href: "/estoque", label: "Estoque", roles: DONO },
    ],
  },
  {
    id: "robo",
    label: "Robô (IA)",
    icon: Bot,
    items: [
      { href: "/robo", label: "Personalidade e regras", roles: DONO },
      { href: "/base-conhecimento", label: "Base de conhecimento", roles: DONO },
    ],
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

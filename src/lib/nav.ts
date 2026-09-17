export type Role = "dono" | "profissional";

export type NavItem = {
  href: string;
  label: string;
  roles: Role[];
  icon: string; // SVG path data, 24x24 viewBox
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    roles: ["dono", "profissional"],
    icon: "M4 19V5M4 19h16M8 15v4M13 11v8M18 7v12",
  },
  {
    href: "/faturamento",
    label: "Faturamento",
    roles: ["dono"],
    icon: "M3 12l9-9 9 9M5 10v10h14V10",
  },
  {
    href: "/conversas",
    label: "Conversas",
    roles: ["dono", "profissional"],
    icon: "M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.5 8.5 0 0 1-3.8-.9L4 20l1-4.3A8.4 8.4 0 1 1 21 11.5Z",
  },
  {
    href: "/crm",
    label: "CRM",
    roles: ["dono"],
    icon: "M2 20c1-3.5 3.5-5 7-5s6 1.5 7 5M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 13c2.8 0 5 1.5 6 5M17 8a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z",
  },
  {
    href: "/tarefas",
    label: "Tarefas",
    roles: ["dono", "profissional"],
    icon: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  },
  {
    href: "/avaliacoes",
    label: "Avaliações",
    roles: ["dono", "profissional"],
    icon: "M12 2.5l2.9 6.9 7.1.6-5.4 4.7 1.6 7-6.2-4-6.2 4 1.6-7L2 10l7.1-.6L12 2.5Z",
  },
  {
    href: "/base-conhecimento",
    label: "Base de conhecimento",
    roles: ["dono"],
    icon: "M4 19V6a2 2 0 0 1 2-2h9l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z",
  },
  {
    href: "/robo",
    label: "Configuração do robô",
    roles: ["dono"],
    icon: "M12 2v3M8 9h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2ZM9 13h.01M15 13h.01M9 17h6",
  },
  {
    href: "/calendario",
    label: "Calendário",
    roles: ["dono", "profissional"],
    icon: "M4 6h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM3 10h18M8 3v4M16 3v4",
  },
  {
    href: "/checkout",
    label: "Checkout",
    roles: ["dono", "profissional"],
    icon: "M3 6h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Zm0 4h18M7 15h4",
  },
  {
    href: "/estoque",
    label: "Estoque",
    roles: ["dono"],
    icon: "M3 9l9-5 9 5-9 5-9-5Zm0 0v7l9 5 9-5V9M12 14v7",
  },
  {
    href: "/sac",
    label: "SAC",
    roles: ["dono", "profissional"],
    icon: "M4 13a8 8 0 0 1 16 0M3 13h4v6H3ZM17 13h4v6h-4Z",
  },
  {
    href: "/conta",
    label: "Conta e assinatura",
    roles: ["dono"],
    icon: "M3 12l9-9 9 9M5 10v10h14V10",
  },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

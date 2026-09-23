// Ícones simples (mesmo estilo de traço usado no resto do app) pra cada
// nicho do seletor de segmento no onboarding.
export function SegmentoIcon({ id, className }: { id: string; className?: string }) {
  const cls = className ?? "icon";
  switch (id) {
    case "salao-beleza":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
        </svg>
      );
    case "barbearia":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <path d="M3 4h11l6 8-6 8H3l6-8-6-8Z" />
          <path d="M14 12h7" />
        </svg>
      );
    case "clinica-estetica":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <path d="M12 21s-7-4.35-9.5-9C.87 8.5 2.5 4 7 4c2 0 4 1.5 5 3 1-1.5 3-3 5-3 4.5 0 6.13 4.5 4.5 8-2.5 4.65-9.5 9-9.5 9Z" />
        </svg>
      );
    case "odontologia":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <path d="M12 3c-3 0-5 2-5 5 0 3.5 1.3 8.5 2.4 11 .4.9 1.7.9 2.1-.1.5-1.2 1-3 1.5-3s1 1.8 1.5 3c.4 1 1.7 1 2.1.1C17.7 16.5 19 11.5 19 8c0-3-2-5-5-5-.8 0-1.5.2-2 .5-.5-.3-1.2-.5-2-.5Z" />
        </svg>
      );
    case "advocacia":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <path d="M12 3v18M5 7l-3 6a4 4 0 0 0 8 0l-3-6ZM19 7l-3 6a4 4 0 0 0 8 0l-3-6ZM5 7h7M12 7h7M6 21h12" />
        </svg>
      );
    case "imoveis":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <path d="M3 11 12 3l9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case "comercio":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <path d="M3 8h18l-1.5 12h-15L3 8Z" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" />
        </svg>
      );
    case "pet":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <circle cx="6" cy="9" r="2" />
          <circle cx="18" cy="9" r="2" />
          <circle cx="9.5" cy="5" r="2" />
          <circle cx="14.5" cy="5" r="2" />
          <path d="M12 12c-3 0-6 1.8-6 4.5S8 21 12 21s6-2 6-4.5S15 12 12 12Z" />
        </svg>
      );
    case "academia":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <path d="M4 8v8M2 10v4M22 10v4M20 8v8M7 12h10" />
        </svg>
      );
    case "restaurante":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <path d="M4 3v7a2 2 0 0 0 2 2v9M4 3v7M8 3v7M4 8h4M18 3c-1.5 0-3 1.5-3 4s1.5 4 1.5 4v10M18 3v18" />
        </svg>
      );
    case "servicos-gerais":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4L14.7 6.3Z" />
        </svg>
      );
    case "floricultura":
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="3" />
          <circle cx="7" cy="11" r="3" />
          <circle cx="17" cy="11" r="3" />
          <circle cx="12" cy="13" r="2.4" />
          <path d="M12 15.5V21" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      );
  }
}

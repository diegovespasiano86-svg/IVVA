import { useId } from "react";

/*
 * Selo "Aprovada pela Meta" (mesmo escudo do site). Só afirma o que é verdade (análise do app aprovada em
 * 10/11/2026 para usar a API oficial do WhatsApp Business). Sem logotipo da Meta, sem "parceiro oficial".
 */
export function MetaShield({ size = 40 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const g = `ms-g-${uid}`;
  const s = `ms-s-${uid}`;
  const c = `ms-c-${uid}`;
  const h = Math.round(size * 1.1);
  const outline = "M100 12 L178 40 V110 C178 160 144 192 100 208 C56 192 22 160 22 110 V40 Z";
  return (
    <span className="meta-halo relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: h }}>
      <svg viewBox="0 0 200 220" width={size} height={h} className="relative" role="img" aria-label="Aprovada pela Meta para usar a API oficial do WhatsApp Business">
        <defs>
          <linearGradient id={g} x1="30" y1="20" x2="170" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2fbf9f" />
            <stop offset="1" stopColor="#8b7fe8" />
          </linearGradient>
          <linearGradient id={s} x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".65" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={c}>
            <path d={outline} />
          </clipPath>
        </defs>
        <path d={outline} fill="#0e0e13" stroke={`url(#${g})`} strokeWidth="4" />
        <path d="M100 30 L162 52 V110 C162 150 136 177 100 191 C64 177 38 150 38 110 V52 Z" fill={`url(#${g})`} />
        <path d="M72 108l20 20 38-42" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <text x="100" y="160" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" letterSpacing="3" fontFamily="var(--font-jakarta), system-ui, sans-serif">
          META
        </text>
        <g clipPath={`url(#${c})`}>
          <rect className="meta-sweep" x="0" y="0" width="50" height="220" fill={`url(#${s})`} />
        </g>
      </svg>
    </span>
  );
}

/* Plaquinha escura de uma linha, discreta, para planos e canais. */
export default function MetaSelo({ className = "" }: { className?: string }) {
  return (
    <div className={`meta-shine inline-flex items-center gap-2.5 rounded-full border border-[#2fbf9f]/50 bg-[#0e0e13] py-1 pl-2 pr-4 text-[12px] font-semibold text-white ${className}`}>
      <MetaShield size={30} />
      Aprovada pela Meta · API oficial do WhatsApp Business
    </div>
  );
}

import { useId } from "react";

/** Marca ivva: onda dentro do quadrado em degradê + wordmark. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2FBF9F" />
          <stop offset="0.55" stopColor="#8B7FE8" />
          <stop offset="1" stopColor="#FF6B5B" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="10" fill={`url(#${id})`} />
      <path
        d="M7 20c2 0 2.5-8 5-8s2 10 4.5 10 2.5-12 5-12 2 10 4.5 10"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span className="flex items-center gap-2.5" aria-label="ivva">
      <LogoMark />
      <span
        className="text-[20px] font-extrabold leading-none tracking-tight"
        style={{ color: tone === "light" ? "#fff" : "var(--ink-deep)" }}
      >
        ivva
      </span>
    </span>
  );
}

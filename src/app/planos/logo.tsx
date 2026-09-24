import { useId } from "react";

// Mesma marca (onda) usada no site público ivva.app.br — mantém a
// identidade visual idêntica entre marketing e checkout.
const WAVE_PATH =
  "M29 44 C 22 45, 14 49, 14 55 C 14 60, 19 62, 23 59 C 27 55, 30 42, 33 31 C 36 21, 39 18, 43 18 C 47 18, 49 22, 51 31 C 53 41, 54 60, 55 70 C 56 78, 57 82, 59 82 C 61 82, 62 78, 63 71 C 64 60, 66 49, 69 44 C 72 39, 76 38, 79 39 C 84 41, 86 45, 84 48 C 82 51, 76 53, 70 53";

function WaveMark({ size = 26, strokeWidth = 7.5 }: { size?: number; strokeWidth?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 96 100" fill="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="10" y1="20" x2="86" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2fbf9f" />
          <stop offset="1" stopColor="#a68ae8" />
        </linearGradient>
      </defs>
      <path
        d={WAVE_PATH}
        stroke={`url(#${id})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function IvvaLogo() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white shadow-[0_4px_14px_-4px_rgba(14,14,19,0.25)]">
        <WaveMark />
      </span>
      <span className="text-[1.55rem] leading-none font-extrabold tracking-[-0.03em] lowercase text-[#353542]">
        ivva
      </span>
    </span>
  );
}

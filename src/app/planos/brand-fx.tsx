"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

// Identidade visual do hero de ivva.app.br trazida pro /planos: mesmo
// degradê de fundo, mesma onda da marca ao fundo e as mesmas bolhas de
// conversa flutuando — pra que marketing e checkout pareçam o mesmo site.
const WAVE_PATH =
  "M29 44 C 22 45, 14 49, 14 55 C 14 60, 19 62, 23 59 C 27 55, 30 42, 33 31 C 36 21, 39 18, 43 18 C 47 18, 49 22, 51 31 C 53 41, 54 60, 55 70 C 56 78, 57 82, 59 82 C 61 82, 62 78, 63 71 C 64 60, 66 49, 69 44 C 72 39, 76 38, 79 39 C 84 41, 86 45, 84 48 C 82 51, 76 53, 70 53";

/** Degradê do hero — mesma receita de camadas do site público. */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10">
      <div className="h-full w-full bg-[radial-gradient(ellipse_at_30%_20%,#1c2a33_0%,#0b0b10_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,11,16,0.55)_0%,rgba(11,11,16,0.35)_40%,rgba(11,11,16,0.85)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(560px_circle_at_0%_45%,rgba(47,191,159,0.28),transparent_65%),radial-gradient(560px_circle_at_100%_100%,rgba(139,127,232,0.32),transparent_65%)]" />
    </div>
  );
}

/** Fundo mais discreto pra seção dos planos, pra não competir com os cards. */
export function GlowBackdrop({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(640px circle at 0% 0%, rgba(47,191,159,0.20), transparent 65%)",
            "radial-gradient(600px circle at 100% 40%, rgba(139,127,232,0.24), transparent 65%)",
            "radial-gradient(520px circle at 45% 110%, rgba(255,107,91,0.14), transparent 65%)",
          ].join(","),
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(247,246,242,0.07) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)",
        }}
      />
    </div>
  );
}

/**
 * A onda da marca atravessando o fundo: desenha-se ao entrar e depois
 * fica em deriva lenta, como no hero do site. Motion desligado quando o
 * sistema pede menos animação.
 */
export function WaveWatermark({
  className = "",
  opacity = 0.14,
  strokeWidth = 4,
  drift = 6,
  duration = 26,
  delay = 0,
}: {
  className?: string;
  opacity?: number;
  strokeWidth?: number;
  drift?: number;
  duration?: number;
  delay?: number;
}) {
  const gradientId = useId();
  const reduced = useReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 96 100"
      fill="none"
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{ opacity }}
      animate={
        reduced
          ? undefined
          : { x: [`-${drift}%`, `${drift}%`], y: ["2%", "-2%"], rotate: [-2.5, 2.5] }
      }
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="10" y1="20" x2="86" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2fbf9f" />
          <stop offset="0.6" stopColor="#8b7fe8" />
          <stop offset="1" stopColor="#ff6b5b" />
        </linearGradient>
      </defs>
      <motion.path
        d={WAVE_PATH}
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={reduced ? undefined : { pathLength: 1 }}
        transition={{ duration: 2.4, ease: [0.65, 0, 0.35, 1] }}
      />
    </motion.svg>
  );
}

/** Bolhas de conversa flutuando nas laterais — as mesmas do hero do site. */
export function FloatingPill({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      className={`absolute hidden xl:block ${className}`}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={
        reduced
          ? { opacity: 1 }
          : { opacity: 1, y: [0, -8, 0] }
      }
      transition={
        reduced
          ? undefined
          : {
              opacity: { duration: 0.6, delay },
              y: { duration: 5, delay, repeat: Infinity, ease: "easeInOut" },
            }
      }
    >
      <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_20px_45px_-20px_rgba(0,0,0,0.8)] backdrop-blur-sm">
        {children}
      </div>
    </motion.div>
  );
}

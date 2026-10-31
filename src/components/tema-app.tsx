"use client";

import { useEffect } from "react";

// Modo claro/escuro do app (só das telas internas; planos, boas-vindas e páginas públicas têm
// o próprio visual e nunca recebem o tema). A escolha fica só neste navegador, como as outras
// preferências de "Aparência". O atributo também é aplicado no <html> antes da primeira pintura
// (ver layout raiz), então a tela não pisca.
export const CHAVE_TEMA = "ivva:tema";
export const EVENTO_TEMA = "ivva:tema-mudou";

export type Tema = "claro" | "escuro";

export function temaGuardado(): Tema {
  try {
    return localStorage.getItem(CHAVE_TEMA) === "escuro" ? "escuro" : "claro";
  } catch {
    return "claro";
  }
}

export function aplicarTema(t: Tema) {
  const html = document.documentElement;
  if (t === "escuro") html.setAttribute("data-theme", "dark");
  else html.removeAttribute("data-theme");
  window.dispatchEvent(new Event(EVENTO_TEMA));
}

/**
 * Montado dentro do AppShell: aplica o tema guardado enquanto o usuário está no app, remove ao sair
 * e desenha o fundo animado (rede de pontos, brilhos que derivam e a onda da marca que aparece e some).
 */
export default function TemaApp() {
  useEffect(() => {
    aplicarTema(temaGuardado());
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, []);

  useEffect(() => {
    const cv = document.getElementById("fx-rede") as HTMLCanvasElement | null;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)");
    const html = document.documentElement;

    type Ponto = { x: number; y: number; vx: number; vy: number; r: number };
    let w = 0;
    let h = 0;
    let dpr = 1;
    let pts: Ponto[] = [];
    let raf = 0;
    let rgb = "109,91,224";
    let escuro = false;

    const lerCor = () => {
      escuro = html.getAttribute("data-theme") === "dark";
      rgb = getComputedStyle(html).getPropertyValue("--fx-rgb").trim() || "109,91,224";
    };
    const medir = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(70, Math.max(26, Math.floor((w * h) / 22000)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.6 + 0.7,
      }));
    };
    const desenhar = (mover: boolean) => {
      ctx.clearRect(0, 0, w, h);
      if (mover) {
        for (const p of pts) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        ctx.beginPath();
        ctx.fillStyle = `rgba(${rgb},0.7)`;
        ctx.arc(a.x, a.y, a.r, 0, 7);
        ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 140) {
            ctx.strokeStyle = `rgba(${rgb},${(1 - d / 140) * (escuro ? 0.22 : 0.3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    };
    const laco = () => {
      desenhar(true);
      raf = requestAnimationFrame(laco);
    };
    const iniciar = () => {
      cancelAnimationFrame(raf);
      lerCor();
      if (reduzir.matches || document.hidden) {
        desenhar(false);
        return;
      }
      raf = requestAnimationFrame(laco);
    };

    medir();
    iniciar();
    const aoRedimensionar = () => {
      medir();
      iniciar();
    };
    window.addEventListener("resize", aoRedimensionar);
    window.addEventListener(EVENTO_TEMA, iniciar);
    document.addEventListener("visibilitychange", iniciar);
    reduzir.addEventListener("change", iniciar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", aoRedimensionar);
      window.removeEventListener(EVENTO_TEMA, iniciar);
      document.removeEventListener("visibilitychange", iniciar);
      reduzir.removeEventListener("change", iniciar);
    };
  }, []);

  const onda = "M2 24c8 0 10-18 20-18s8 30 18 30 10-26 20-26 8 22 18 22 10-14 20-14 8 10 18 10";
  return (
    <div className="fx" aria-hidden="true">
      <canvas id="fx-rede" className="fx-rede" />
      <span className="fx-blob fx-b1" />
      <span className="fx-blob fx-b2" />
      <span className="fx-blob fx-b3" />
      <svg className="fx-marca fx-m1" viewBox="0 0 120 40">
        <path pathLength={1} d={onda} />
      </svg>
      <svg className="fx-marca fx-m2" viewBox="0 0 120 40">
        <path pathLength={1} d={onda} />
      </svg>
    </div>
  );
}

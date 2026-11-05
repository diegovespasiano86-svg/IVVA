export const FORMATOS = ["Reels", "Carrossel", "Vídeo curto", "POV", "Post estático"] as const;

/** Horários da reunião: 25 min, começando em :00 ou :30, das 10h às 19h30 (5 min de folga até o próximo). */
export const HORARIOS = Array.from({ length: 20 }, (_, i) => {
  const min = 10 * 60 + i * 30;
  const h = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { inicio: h(min), fim: h(min + 25) };
});

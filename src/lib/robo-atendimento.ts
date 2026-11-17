// Estado do robô para um contato: atende, só humano ou silenciado até uma data.
export function estadoRobo(modo: string | null | undefined, silenciadoAte: string | null | undefined, agora = Date.now()) {
  if (modo && modo !== "atende") return { tipo: "humano" as const };
  if (silenciadoAte && new Date(silenciadoAte).getTime() > agora) return { tipo: "silenciado" as const, ate: silenciadoAte };
  return { tipo: "atende" as const };
}

export type EstadoRobo = ReturnType<typeof estadoRobo>;

export function rotuloEstadoRobo(e: EstadoRobo) {
  if (e.tipo === "humano") return "Só humano";
  if (e.tipo === "silenciado")
    return `Robô silenciado até ${new Date(e.ate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}`;
  return "Robô atende";
}

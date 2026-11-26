// O banco guarda e devolve horários em UTC. A IA só pode ver e informar horário de Brasília,
// então tudo que entra ou sai das ferramentas do robô passa por aqui.

const FUSO = "America/Sao_Paulo";
const OFFSET = "-03:00"; // Brasil sem horário de verão desde 2019
const TRES_HORAS = 3 * 3600 * 1000;

/** "2026-11-28T13:00:00+00:00" -> "2026-11-28T10:00:00-03:00" (mesmo instante). */
export function paraBrasilia(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return new Date(t - TRES_HORAS).toISOString().slice(0, 19) + OFFSET;
}

/** Texto pronto para falar ao cliente: "sábado, 28/11 às 10:00". */
export function quandoFalado(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long" });
  const data = d.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
  return `${dia}, ${data} às ${hora}`;
}

/** Data/hora escrita pela IA sem fuso vale como horário de Brasília. Sem isso o banco lê como UTC (3h antes). */
export function lerDataHora(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor.trim()) return null;
  let v = valor.trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v += "T00:00:00";
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(v)) v += OFFSET;
  return Number.isNaN(new Date(v).getTime()) ? null : v;
}

/** Troca os horários de um retorno do banco (data_hora, primeiro_horario_possivel, slots) para Brasília. */
export function retornoEmBrasilia(dados: unknown): unknown {
  if (Array.isArray(dados)) return dados.map(retornoEmBrasilia);
  if (!dados || typeof dados !== "object") return dados;
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(dados as Record<string, unknown>)) {
    if ((chave === "data_hora" || chave === "primeiro_horario_possivel") && typeof valor === "string") {
      saida[chave] = paraBrasilia(valor);
      if (chave === "data_hora") saida.quando = quandoFalado(valor);
    } else {
      saida[chave] = retornoEmBrasilia(valor);
    }
  }
  return saida;
}

/** Calendário dos próximos dias para a IA não calcular dia da semana de cabeça. */
export function calendarioProximosDias(agora: Date = new Date(), dias = 21): string {
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(agora.getTime() + i * 24 * 3600 * 1000);
    const nome = d.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long" });
    const data = d.toLocaleDateString("en-CA", { timeZone: FUSO });
    return `${nome} = ${data}${i === 0 ? " (hoje)" : i === 1 ? " (amanhã)" : ""}`;
  }).join("\n");
}

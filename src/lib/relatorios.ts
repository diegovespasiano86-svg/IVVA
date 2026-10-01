// Utilidades dos relatórios: período, séries por dia, formatação e exportação (CSV/Excel).

export type ChavePeriodo = "7d" | "30d" | "90d" | "mes" | "tudo";

export type Periodo = {
  chave: ChavePeriodo;
  label: string;
  desde: Date;
  dias: number;
};

export const PERIODOS: { chave: ChavePeriodo; label: string }[] = [
  { chave: "7d", label: "7 dias" },
  { chave: "30d", label: "30 dias" },
  { chave: "90d", label: "90 dias" },
  { chave: "mes", label: "Este mês" },
];

const FUSO = "America/Sao_Paulo";

/** AAAA-MM-DD no fuso de São Paulo. */
export function diaSP(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: FUSO });
}

export function lerPeriodo(v?: string): Periodo {
  const agora = new Date();
  // "tudo" só serve para exportar a base inteira (não aparece no seletor de período).
  if (v === "tudo") return { chave: "tudo", label: "Todo o período", desde: new Date("2000-01-01T00:00:00-03:00"), dias: 365 };
  const chave: ChavePeriodo = v === "7d" || v === "90d" || v === "mes" ? v : "30d";
  if (chave === "mes") {
    const [a, m] = diaSP(agora).split("-");
    const desde = new Date(`${a}-${m}-01T00:00:00-03:00`);
    const dias = Math.max(1, Math.ceil((agora.getTime() - desde.getTime()) / 86400000));
    return { chave, label: "Este mês", desde, dias };
  }
  const dias = chave === "7d" ? 7 : chave === "90d" ? 90 : 30;
  const desde = new Date(agora.getTime() - dias * 86400000);
  return { chave, label: `Últimos ${dias} dias`, desde, dias };
}

/** Série contínua (um ponto por dia, com zeros) a partir de datas ou de pares data/valor. */
export function serieDiaria(
  itens: { data: string; valor?: number }[],
  periodo: Periodo,
): { rotulo: string; valor: number }[] {
  const mapa = new Map<string, number>();
  for (const it of itens) {
    const k = diaSP(it.data);
    mapa.set(k, (mapa.get(k) ?? 0) + (it.valor ?? 1));
  }
  const pontos: { rotulo: string; valor: number }[] = [];
  const hoje = new Date();
  for (let i = periodo.dias - 1; i >= 0; i--) {
    const d = new Date(hoje.getTime() - i * 86400000);
    const k = diaSP(d);
    const [, m, dia] = k.split("-");
    pontos.push({ rotulo: `${dia}/${m}`, valor: Math.round((mapa.get(k) ?? 0) * 100) / 100 });
  }
  return pontos;
}

export function agrupar(
  valores: (string | null | undefined)[],
  vazio = "Não informado",
): { rotulo: string; valor: number }[] {
  const m = new Map<string, number>();
  for (const v of valores) {
    const k = (v ?? "").trim() || vazio;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor);
}

export const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarDuracao(segundos: number | null): string {
  if (segundos === null || !Number.isFinite(segundos)) return "—";
  if (segundos < 60) return `${Math.round(segundos)} s`;
  const min = segundos / 60;
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  return `${h.toFixed(1).replace(".", ",")} h`;
}

export function mediana(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2;
}

// ---------- exportação ----------

export type Celula = string | number | null;

/** Evita "injeção de fórmula": célula que começa com = + - @ vira texto no Excel. */
function neutralizar(v: Celula): Celula {
  if (typeof v !== "string") return v;
  return /^[\s=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/.test(v) ? `'${v}` : v;
}

/** CSV para Excel brasileiro: separador ";", BOM UTF-8, aspas escapadas. */
export function montarCsv(colunas: string[], linhas: Celula[][]): string {
  const esc = (v: Celula) => {
    const t = v === null || v === undefined ? "" : String(neutralizar(v));
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const corpo = [colunas, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
  return "﻿" + corpo + "\r\n";
}

export async function montarXlsx(nomeAba: string, colunas: string[], linhas: Celula[][]): Promise<Buffer> {
  const { default: writeXlsxFile } = await import("write-excel-file/node");
  const dados = [
    colunas.map((c) => ({ value: c, fontWeight: "bold" as const })),
    ...linhas.map((l) =>
      l.map((v) => {
        const n = neutralizar(v);
        return n === null ? null : typeof n === "number" ? { value: n, type: Number } : { value: String(n), type: String };
      }),
    ),
  ];
  const arquivo = writeXlsxFile(dados as never, { sheet: nomeAba.slice(0, 30), columns: colunas.map(() => ({ width: 22 })) } as never);
  return arquivo.toBuffer();
}

export type Dataset = { arquivo: string; titulo: string; colunas: string[]; linhas: Celula[][] };

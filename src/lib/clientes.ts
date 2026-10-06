// Regras puras de "Clientes": telefone, leitura de CSV e classificação RFV.
// Sem dependência de servidor: roda no navegador (importação) e no servidor.

/** Telefone BR normalizado para o formato do WhatsApp: só dígitos com 55 na frente (12 ou 13 dígitos). */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  let d = String(bruto ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!(d.length === 12 || d.length === 13) || !d.startsWith("55")) return null;
  const ddd = Number(d.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  const numero = d.slice(4);
  // celular começa com 9 (9 dígitos); fixo tem 8 dígitos e começa de 2 a 5
  if (numero.length === 9 && numero[0] !== "9") return null;
  if (numero.length === 8 && !/[2-5]/.test(numero[0])) return null;
  return d;
}

export function formatarTelefone(t: string | null | undefined): string {
  const n = normalizarTelefone(t);
  if (!n) return t ?? "";
  const ddd = n.slice(2, 4);
  const num = n.slice(4);
  return num.length === 9 ? `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}` : `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
}

/** Aniversário vindo de planilha: aceita DD/MM/AAAA, AAAA-MM-DD ou só DD/MM (sem ano, grava 2000). Devolve AAAA-MM-DD ou null. */
export function normalizarDataNascimento(bruto: string | null | undefined): string | null {
  const s = String(bruto ?? "").trim();
  let d: number, m: number, a: number;
  let r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (r) {
    d = Number(r[1]);
    m = Number(r[2]);
    a = Number(r[3]);
    if (r[3].length === 2) a += a > 30 ? 1900 : 2000;
  } else if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    a = Number(r[1]);
    m = Number(r[2]);
    d = Number(r[3]);
  } else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})$/))) {
    d = Number(r[1]);
    m = Number(r[2]);
    a = 2000;
  } else return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (a < 1900 || a > new Date().getUTCFullYear()) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Lê CSV (detecta ; , ou tab; aceita aspas e quebras de linha dentro de aspas). */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const cont = (c: string) => primeira.split(c).length - 1;
  const sep = cont(";") >= cont(",") && cont(";") >= cont("\t") ? ";" : cont("\t") > cont(",") ? "\t" : ",";

  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim() !== "")) linhas.push(linha);
  return linhas;
}

// ---------- RFV ----------

export type SegmentoId = "novo" | "vip" | "fiel" | "em_risco" | "perdido" | "sem_compra";

export const SEGMENTOS_RFV: { id: SegmentoId; label: string; dica: string; badge: string }[] = [
  { id: "vip", label: "VIP", dica: "4 ou mais visitas no último ano e voltou nos últimos 45 dias", badge: "badge-brand" },
  { id: "fiel", label: "Fiéis", dica: "2 ou mais visitas e voltou nos últimos 60 dias", badge: "badge-success" },
  { id: "novo", label: "Novos", dica: "Cadastrados há menos de 30 dias", badge: "badge-info" },
  { id: "em_risco", label: "Em risco", dica: "Última visita entre 61 e 120 dias atrás", badge: "badge-warn" },
  { id: "perdido", label: "Perdidos", dica: "Sem visita há mais de 120 dias", badge: "badge-danger" },
  { id: "sem_compra", label: "Sem compras", dica: "Ainda não fecharam nenhum atendimento", badge: "badge-neutral" },
];

export type Rfv = {
  segmento: SegmentoId;
  recenciaDias: number | null;
  frequencia: number;
  valor: number;
};

const DIA = 86400000;

/** Classificação simples e transparente. Visita = pagamento no Checkout ou agendamento concluído. */
export function calcularRfv(p: { criadoEm: string; visitas: string[]; valor12m: number; agora: number }): Rfv {
  const datas = p.visitas.map((v) => new Date(v).getTime()).filter((n) => Number.isFinite(n));
  const ultima = datas.length ? Math.max(...datas) : null;
  const recenciaDias = ultima === null ? null : Math.max(0, Math.floor((p.agora - ultima) / DIA));
  const freq12m = datas.filter((t) => p.agora - t <= 365 * DIA).length;
  const idadeCadastro = Math.floor((p.agora - new Date(p.criadoEm).getTime()) / DIA);

  let segmento: SegmentoId;
  if (recenciaDias === null) segmento = idadeCadastro < 30 ? "novo" : "sem_compra";
  else if (freq12m >= 4 && recenciaDias <= 45) segmento = "vip";
  else if (freq12m >= 2 && recenciaDias <= 60) segmento = "fiel";
  else if (idadeCadastro < 30 && freq12m <= 1) segmento = "novo";
  else if (recenciaDias <= 60) segmento = "fiel";
  else if (recenciaDias <= 120) segmento = "em_risco";
  else segmento = "perdido";

  return { segmento, recenciaDias, frequencia: freq12m, valor: p.valor12m };
}

export const rotuloSegmento = (id: SegmentoId) => SEGMENTOS_RFV.find((s) => s.id === id)!;

// ---------- etiquetas ----------
export const CORES_ETIQUETA = ["cinza", "vermelho", "laranja", "amarelo", "verde", "azul", "roxo", "rosa"] as const;
export type CorEtiqueta = (typeof CORES_ETIQUETA)[number];

/** Classes de cor (fundo suave + texto com contraste) de cada etiqueta. */
export const ESTILO_ETIQUETA: Record<CorEtiqueta, string> = {
  cinza: "bg-[#efecf3] text-[#4a4458]",
  vermelho: "bg-[#fdece9] text-[#a82f20]",
  laranja: "bg-[#ffeddb] text-[#8f4a00]",
  amarelo: "bg-[#fbf3cf] text-[#6b5800]",
  verde: "bg-[#e3f4ef] text-[#0b6a56]",
  azul: "bg-[#e6eefc] text-[#1d4c9e]",
  roxo: "bg-[#ece9fc] text-[#5a49c9]",
  rosa: "bg-[#fde6f1] text-[#a02a63]",
};

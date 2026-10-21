// Regras puras da importação do histórico de vendas: data, forma de pagamento e a regra dos meses anteriores.
// Sem dependência de servidor: roda no navegador (prévia) e no servidor (revalidação).
import { lerNumero } from "./catalogo-importacao";
import { normalizarTelefone } from "./clientes";

export type Forma = "pix" | "credito" | "debito" | "dinheiro";

export type VendaBruta = {
  data?: string;
  telefone?: string;
  nome?: string;
  valor?: string;
  forma?: string;
  descricao?: string;
  profissional?: string;
};

export type VendaPronta = {
  /** Instante gravado: meio-dia no horário de Brasília do dia informado. */
  quando: string;
  telefone: string;
  nome: string;
  valor: number;
  forma: Forma;
  descricao: string;
  profissional: string;
};

export type MotivoRecusa = "data_invalida" | "mes_atual_ou_futuro" | "muito_antiga" | "telefone_invalido" | "valor_invalido" | "forma_invalida";

const ANO_MINIMO = 2015;

/** Primeiro dia do mês atual no horário de Brasília, como AAAA-MM-DD. Vendas a partir dele não entram. */
export function inicioDoMesAtual(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(agora);
  return `${partes}-01`;
}

/** DD/MM/AAAA, DD-MM-AAAA ou AAAA-MM-DD (com ou sem hora). Devolve AAAA-MM-DD ou null. */
export function lerDataVenda(bruto: string | null | undefined): string | null {
  const s = String(bruto ?? "").trim().split(/[ T]/)[0];
  let d: number, m: number, a: number;
  let r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (r) {
    d = Number(r[1]);
    m = Number(r[2]);
    a = Number(r[3]);
  } else if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    a = Number(r[1]);
    m = Number(r[2]);
    d = Number(r[3]);
  } else return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function lerForma(bruto: string | null | undefined): Forma | null {
  const s = String(bruto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (!s) return null;
  if (/pix/.test(s)) return "pix";
  if (/deb/.test(s)) return "debito";
  if (/cred|cart|parcel/.test(s)) return "credito";
  if (/dinh|especie|cash|\bvista\b/.test(s)) return "dinheiro";
  return null;
}

/** Valida uma linha. Devolve a venda pronta ou o motivo de ter sido recusada. */
export function montarVenda(r: VendaBruta, formaPadrao: Forma | null, hoje: Date = new Date()): { venda: VendaPronta } | { motivo: MotivoRecusa } {
  const dia = lerDataVenda(r.data);
  if (!dia) return { motivo: "data_invalida" };
  if (dia >= inicioDoMesAtual(hoje)) return { motivo: "mes_atual_ou_futuro" };
  if (Number(dia.slice(0, 4)) < ANO_MINIMO) return { motivo: "muito_antiga" };
  const telefone = normalizarTelefone(r.telefone);
  if (!telefone) return { motivo: "telefone_invalido" };
  const valor = lerNumero(r.valor);
  if (valor === null || valor <= 0 || valor > 1_000_000) return { motivo: "valor_invalido" };
  const forma = String(r.forma ?? "").trim() ? lerForma(r.forma) : formaPadrao;
  if (!forma) return { motivo: "forma_invalida" };
  return {
    venda: {
      quando: `${dia}T12:00:00-03:00`,
      telefone,
      nome: String(r.nome ?? "").trim().slice(0, 120),
      valor: Math.round(valor * 100) / 100,
      forma,
      descricao: String(r.descricao ?? "").trim().slice(0, 120),
      profissional: String(r.profissional ?? "").trim().slice(0, 120),
    },
  };
}

export const ROTULO_MOTIVO: Record<MotivoRecusa, string> = {
  data_invalida: "data inválida",
  mes_atual_ou_futuro: "do mês atual ou futuro",
  muito_antiga: "anterior a 2015",
  telefone_invalido: "telefone inválido",
  valor_invalido: "valor inválido",
  forma_invalida: "forma de pagamento não reconhecida",
};

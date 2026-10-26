import { randomBytes } from "crypto";
import { asaas, type Ambiente } from "./asaas";

// Conta Asaas da PRÓPRIA ivva: recebe as mensalidades de quem assina pagando no Pix (sem teste grátis).
// Não confundir com src/lib/asaas.ts usado pelas contas Asaas dos clientes (Checkout).
// Variáveis (Vercel): ASAAS_IVVA_API_KEY, ASAAS_IVVA_AMBIENTE ("sandbox" | "producao", padrão producao),
// ASAAS_IVVA_WEBHOOK_TOKEN (o mesmo token cadastrado no webhook do Asaas) e ASAAS_IVVA_LIBERADO=1 para mostrar a
// opção a todos (sem ela, a opção só aparece em /planos?pix=teste).

export function ambienteIvva(): Ambiente {
  return process.env.ASAAS_IVVA_AMBIENTE === "sandbox" ? "sandbox" : "producao";
}

function contaIvva(ambiente: Ambiente = ambienteIvva()) {
  const chave = process.env.ASAAS_IVVA_API_KEY;
  if (!chave) throw new Error("Pagamento no Pix indisponível no momento.");
  // A chave configurada é de um ambiente só; registros de outro ambiente (ex.: testes no sandbox) não são tocados.
  if (ambiente !== ambienteIvva()) throw new Error("Assinatura de outro ambiente do Asaas.");
  return { chave, ambiente };
}

export function pixAssinaturaConfigurada() {
  return Boolean(process.env.ASAAS_IVVA_API_KEY);
}

export function pixAssinaturaLiberada() {
  return pixAssinaturaConfigurada() && process.env.ASAAS_IVVA_LIBERADO === "1";
}

export function novaRefPix() {
  return `pix_${randomBytes(16).toString("hex")}`;
}

function hojeEmSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export type PixGerado = { copiaECola: string; imagem: string; expira: string | null };

/** Cria cliente + assinatura (Pix, vence hoje) no Asaas e devolve o Pix da 1ª cobrança. */
export async function criarAssinaturaPix(p: {
  ref: string;
  nome: string;
  email: string;
  telefone: string;
  cpfCnpj: string;
  nomeNegocio: string;
  valor: number;
  anual: boolean;
  descricao: string;
}) {
  const conta = contaIvva();
  const cliente = await asaas<{ id: string }>(conta, "/customers", {
    method: "POST",
    body: {
      name: p.nome.slice(0, 100),
      email: p.email,
      mobilePhone: p.telefone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""),
      cpfCnpj: p.cpfCnpj,
      company: p.nomeNegocio.slice(0, 100),
      externalReference: p.ref,
      notificationDisabled: false,
    },
  });
  const assinatura = await asaas<{ id: string }>(conta, "/subscriptions", {
    method: "POST",
    body: {
      customer: cliente.id,
      billingType: "PIX",
      value: p.valor,
      nextDueDate: hojeEmSaoPaulo(),
      cycle: p.anual ? "YEARLY" : "MONTHLY",
      description: p.descricao.slice(0, 500),
      externalReference: p.ref,
    },
  });
  const cobrancas = await asaas<{ data?: { id: string }[] }>(conta, `/subscriptions/${encodeURIComponent(assinatura.id)}/payments`);
  const primeira = cobrancas.data?.[0]?.id;
  if (!primeira) throw new Error("O Asaas não gerou a primeira cobrança.");
  const pix = await pixDaCobranca(primeira);
  return { clienteId: cliente.id, assinaturaId: assinatura.id, cobrancaId: primeira, ambiente: conta.ambiente, pix };
}

export async function pixDaCobranca(cobrancaId: string): Promise<PixGerado> {
  const r = await asaas<{ payload: string; encodedImage: string; expirationDate?: string }>(
    contaIvva(),
    `/payments/${encodeURIComponent(cobrancaId)}/pixQrCode`,
  );
  return { copiaECola: r.payload, imagem: r.encodedImage, expira: r.expirationDate ?? null };
}

/** Situação de uma cobrança no Asaas (usado como reserva quando o webhook ainda não chegou). */
export async function cobrancaPaga(cobrancaId: string, ambiente: Ambiente) {
  const r = await asaas<{ status: string; dueDate?: string }>(contaIvva(ambiente), `/payments/${encodeURIComponent(cobrancaId)}`);
  return { paga: ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(r.status), vencimento: r.dueDate ?? null };
}

/** Cancela no Asaas uma assinatura que ficou sem pagamento (nova tentativa do mesmo e-mail). */
export async function removerAssinatura(assinaturaId: string, ambiente: Ambiente) {
  await asaas(contaIvva(ambiente), `/subscriptions/${encodeURIComponent(assinaturaId)}`, { method: "DELETE" });
}

/** Cobrança em aberto (pendente ou vencida) da assinatura, para a tela Minha assinatura. */
export async function cobrancaEmAberto(assinaturaId: string, ambiente: Ambiente) {
  for (const status of ["OVERDUE", "PENDING"]) {
    const r = await asaas<{ data?: { id: string; value: number; dueDate: string; invoiceUrl: string }[] }>(
      contaIvva(ambiente),
      `/payments?subscription=${encodeURIComponent(assinaturaId)}&status=${status}&limit=1`,
    );
    const c = r.data?.[0];
    if (c) return { valor: c.value, vencimento: c.dueDate, url: c.invoiceUrl, vencida: status === "OVERDUE" };
  }
  return null;
}

/** CPF ou CNPJ com dígitos verificadores válidos. Devolve só os números, ou null. */
export function cpfCnpjValido(bruto: string): string | null {
  const d = bruto.replace(/\D/g, "");
  if (/^(\d)\1+$/.test(d)) return null;
  const dv = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (d.length === 11) {
    const p1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    const p2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
    const ok = dv(d.slice(0, 9), p1) === Number(d[9]) && dv(d.slice(0, 10), p2) === Number(d[10]);
    return ok ? d : null;
  }
  if (d.length === 14) {
    const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const ok = dv(d.slice(0, 12), p1) === Number(d[12]) && dv(d.slice(0, 13), p2) === Number(d[13]);
    return ok ? d : null;
  }
  return null;
}

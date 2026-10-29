import { createClient } from "@supabase/supabase-js";

// Cobrança pela conta Asaas do PRÓPRIO negócio (cada cliente da ivva conecta a sua). A ivva nunca segura o dinheiro:
// o valor cai na conta Asaas do negócio e o webhook avisa a ivva para dar baixa no estoque e nos relatórios.
// Cobrança por Link de Pagamento, sem cadastrar o pagador (o Asaas exige CPF para cliente cadastrado, o que atrapalharia o balcão):
// o pagador preenche os dados na página do Asaas. No Checkout o link é só de cartão de crédito; o robô manda o link em que o cliente escolhe Pix ou cartão.
// O Pix QR Code estático foi retirado (não dava para comprovar a baixa automática); o Pix fica no Mercado Pago ou na chave Pix própria.

export type Ambiente = "sandbox" | "producao";
export type ContaAsaas = { chave: string; ambiente: Ambiente; webhook_token: string };

const BASE: Record<Ambiente, string> = {
  producao: "https://api.asaas.com/v3",
  sandbox: "https://api-sandbox.asaas.com/v3",
};

function supabaseServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) throw new Error("Cobrança indisponível no momento.");
  return { supabase: createClient(url, anon), secret };
}

export async function lerContaAsaas(tenantId: string): Promise<ContaAsaas | null> {
  const { supabase, secret } = supabaseServidor();
  const { data, error } = await supabase.rpc("asaas_conta_ler", { p_secret: secret, p_tenant: tenantId });
  if (error) throw new Error("Não consegui ler a conexão com o Asaas.");
  return (data as ContaAsaas | null) ?? null;
}

export async function salvarContaAsaas(tenantId: string, chave: string, ambiente: Ambiente, token: string) {
  const { supabase, secret } = supabaseServidor();
  const { error } = await supabase.rpc("asaas_conta_salvar", { p_secret: secret, p_tenant: tenantId, p_chave: chave, p_ambiente: ambiente, p_token: token });
  if (error) throw new Error("Não consegui guardar a conexão com o Asaas.");
}

/** Chamada à API do Asaas. Erros viram mensagens legíveis (o texto técnico vai só para o log). */
export async function asaas<T = Record<string, unknown>>(conta: { chave: string; ambiente: Ambiente }, caminho: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${BASE[conta.ambiente]}${caminho}`, {
    method: init?.method ?? "GET",
    headers: { access_token: conta.chave, "content-type": "application/json", "user-agent": "ivva" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { errors?: { description?: string }[] } & T;
  if (!res.ok) {
    const msg = data.errors?.[0]?.description ?? `erro ${res.status}`;
    console.error("[asaas]", caminho, res.status, msg);
    if (res.status === 401) throw new Error("A chave do Asaas não foi aceita. Confira se copiou inteira e se é do ambiente certo.");
    throw new Error(`O Asaas recusou: ${msg}`);
  }
  return data;
}

/** Confere a chave e devolve o saldo (prova de que a conexão funciona). */
export async function validarChave(conta: { chave: string; ambiente: Ambiente }) {
  return asaas<{ balance: number }>(conta, "/finance/balance");
}

/** Cria o aviso automático (webhook) da conta do negócio apontando para a ivva. Falha não impede a conexão. */
export async function criarWebhook(conta: { chave: string; ambiente: Ambiente }, url: string, token: string, email: string) {
  await asaas(conta, "/webhooks", {
    method: "POST",
    body: {
      name: "ivva",
      url,
      email,
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: token,
      sendType: "NON_SEQUENTIALLY",
      events: ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"],
    },
  });
}

/** Link de Pagamento de uso único: o pagador informa os próprios dados na página do Asaas. `tipo`: só cartão de crédito ou o pagador escolhe (Pix ou cartão). */
export async function criarLinkPagamento(conta: { chave: string; ambiente: Ambiente }, valor: number, nome: string, descricao: string, tipo: "CREDIT_CARD" | "UNDEFINED" = "UNDEFINED") {
  const r = await asaas<{ id: string; url: string }>(conta, "/paymentLinks", {
    method: "POST",
    body: { name: nome.slice(0, 30), description: descricao.slice(0, 500), billingType: tipo, chargeType: "DETACHED", value: valor, dueDateLimitDays: 3, notificationEnabled: false },
  });
  return { id: r.id, url: r.url };
}

/** Desativa um link já pago, para ninguém pagar duas vezes o mesmo carrinho. */
export async function desativarLink(conta: { chave: string; ambiente: Ambiente }, id: string) {
  await asaas(conta, `/paymentLinks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

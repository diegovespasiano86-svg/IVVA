import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// Cobrança pela conta Mercado Pago do PRÓPRIO negócio, conectada por OAuth (o cliente autoriza a ivva com um clique).
// A ivva nunca segura o dinheiro: cai direto na conta Mercado Pago do negócio e o webhook avisa para dar baixa
// no estoque e nos relatórios (mesma função do Asaas, cobranca_paga). Três formas: Pix, link (Pix/cartão) e maquininha Point.

const API = "https://api.mercadopago.com";

export type ContaMP = { access: string; refresh: string | null; expira_em: string | null; terminal_id: string | null; mp_user_id: number };

/** O botão "Conectar Mercado Pago" só aparece quando as credenciais do app da ivva estão na Vercel. */
export function mpDisponivel() {
  return !!(process.env.MERCADOPAGO_CLIENT_ID && process.env.MERCADOPAGO_CLIENT_SECRET);
}

function supabaseServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) throw new Error("Cobrança indisponível no momento.");
  return { supabase: createClient(url, anon), secret };
}

export async function salvarContaMP(tenantId: string, t: { access_token: string; refresh_token?: string | null; user_id: number; expires_in?: number }) {
  const { supabase, secret } = supabaseServidor();
  const expira = t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null;
  const { error } = await supabase.rpc("mp_conta_salvar", {
    p_secret: secret,
    p_tenant: tenantId,
    p_user: t.user_id,
    p_access: t.access_token,
    p_refresh: t.refresh_token ?? null,
    p_expira: expira,
  });
  if (error) throw new Error("Não consegui guardar a conexão com o Mercado Pago.");
}

type RespostaToken = { access_token: string; refresh_token?: string; user_id: number; expires_in?: number };

async function pedirToken(corpo: Record<string, string>): Promise<RespostaToken> {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: process.env.MERCADOPAGO_CLIENT_ID, client_secret: process.env.MERCADOPAGO_CLIENT_SECRET, ...corpo }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<RespostaToken> & { message?: string };
  if (!res.ok || !data.access_token || !data.user_id) {
    console.error("[mercadopago] oauth/token", res.status, data.message);
    throw new Error("O Mercado Pago não autorizou a conexão. Tente de novo.");
  }
  return data as RespostaToken;
}

/** Troca o código do retorno do OAuth pelos tokens do vendedor. */
export function trocarCodigo(code: string, redirectUri: string) {
  return pedirToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

/** Lê a conexão do negócio; renova o token sozinho quando faltam menos de 7 dias para vencer (vale 180 dias). */
export async function lerContaMP(tenantId: string): Promise<ContaMP | null> {
  const { supabase, secret } = supabaseServidor();
  const { data, error } = await supabase.rpc("mp_conta_ler", { p_secret: secret, p_tenant: tenantId });
  if (error) throw new Error("Não consegui ler a conexão com o Mercado Pago.");
  const conta = (data as ContaMP | null) ?? null;
  if (!conta) return null;
  const vencendo = conta.expira_em && new Date(conta.expira_em).getTime() - Date.now() < 7 * 86400_000;
  if (vencendo && conta.refresh) {
    try {
      const t = await pedirToken({ grant_type: "refresh_token", refresh_token: conta.refresh });
      await salvarContaMP(tenantId, t);
      return { ...conta, access: t.access_token, refresh: t.refresh_token ?? conta.refresh, expira_em: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : conta.expira_em };
    } catch (e) {
      console.error("[mercadopago] renovar token falhou", e);
    }
  }
  return conta;
}

/** Chamada à API do Mercado Pago com o token do negócio. Erros viram mensagens legíveis (o texto técnico vai só para o log). */
export async function mp<T = Record<string, unknown>>(conta: { access: string }, caminho: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const metodo = init?.method ?? "GET";
  const res = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${conta.access}`,
      "content-type": "application/json",
      ...(metodo === "POST" ? { "x-idempotency-key": randomUUID() } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string; cause?: { description?: string }[]; errors?: { message?: string; code?: string }[] } & T;
  if (!res.ok) {
    const msg = data.errors?.[0]?.message ?? data.cause?.[0]?.description ?? data.message ?? data.error ?? `erro ${res.status}`;
    console.error("[mercadopago]", caminho, res.status, msg);
    if (res.status === 401) throw new Error("A conexão com o Mercado Pago venceu. Conecte de novo em Integrações.");
    throw new Error(`O Mercado Pago recusou: ${msg}`);
  }
  return data;
}

/** Pix com valor. `ref` (id da cobrança da ivva) volta no aviso de pagamento como external_reference. */
export async function criarPixMP(conta: { access: string }, valor: number, descricao: string, ref: string, emailPagador: string) {
  const r = await mp<{ id: number; point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } } }>(conta, "/v1/payments", {
    method: "POST",
    body: {
      transaction_amount: valor,
      description: descricao.slice(0, 200),
      payment_method_id: "pix",
      external_reference: ref,
      payer: { email: emailPagador },
      date_of_expiration: new Date(Date.now() + 3600_000).toISOString().replace("Z", "-00:00"),
    },
  });
  const td = r.point_of_interaction?.transaction_data;
  if (!td?.qr_code) throw new Error("O Mercado Pago não devolveu o código Pix. Confira se a sua conta está habilitada para Pix.");
  return { id: String(r.id), copiaECola: td.qr_code, imagem: td.qr_code_base64 ?? null };
}

/** Link de pagamento (Pix ou cartão) de uso único: o pagador informa os próprios dados na página do Mercado Pago. */
export async function criarLinkMP(conta: { access: string }, valor: number, titulo: string, ref: string) {
  const r = await mp<{ id: string; init_point: string }>(conta, "/checkout/preferences", {
    method: "POST",
    body: {
      items: [{ title: titulo.slice(0, 120), quantity: 1, unit_price: valor, currency_id: "BRL" }],
      external_reference: ref,
      expires: true,
      expiration_date_to: new Date(Date.now() + 3 * 86400_000).toISOString().replace("Z", "-00:00"),
    },
  });
  return { id: r.id, url: r.init_point };
}

export type TerminalMP = { id: string; operating_mode?: string };

/** Maquininhas Point da conta (para o dono escolher qual recebe as cobranças). */
export async function listarTerminaisMP(conta: { access: string }): Promise<TerminalMP[]> {
  const r = await mp<{ data?: { terminals?: TerminalMP[] } }>(conta, "/terminals/v1/list?limit=50");
  return r.data?.terminals ?? [];
}

/** Manda a cobrança direto para a maquininha Point (o cliente só passa o cartão ou aproxima). */
export async function criarOrdemPointMP(conta: { access: string; terminal_id: string | null }, valor: number, descricao: string, ref: string) {
  if (!conta.terminal_id) throw new Error("Escolha a maquininha Point em Integrações antes de cobrar nela.");
  const r = await mp<{ id: string }>(conta, "/v1/orders", {
    method: "POST",
    body: {
      type: "point",
      external_reference: ref,
      description: descricao.slice(0, 150),
      expiration_time: "PT16M",
      transactions: { payments: [{ amount: valor.toFixed(2) }] },
      config: { point: { terminal_id: conta.terminal_id, print_on_terminal: "no_ticket" } },
    },
  });
  return { id: r.id };
}

/** Forma de pagamento da ivva a partir do tipo do Mercado Pago. */
export function formaDoMP(tipo: string | undefined): "pix" | "credito" | "debito" {
  if (tipo === "credit_card") return "credito";
  if (tipo === "debit_card") return "debito";
  return "pix";
}

/** Confere a assinatura do aviso (x-signature) com o segredo do app: só o Mercado Pago consegue gerá-la. */
export function assinaturaValida(h: { signature: string | null; requestId: string | null }, dataId: string): boolean {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!segredo || !h.signature) return false;
  const partes = Object.fromEntries(h.signature.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  const manifesto = `id:${dataId.toLowerCase()};request-id:${h.requestId ?? ""};ts:${partes.ts};`;
  const esperado = createHmac("sha256", segredo).update(manifesto).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(partes.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

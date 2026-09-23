// Cliente Stripe minimalista via fetch — evita depender do SDK oficial
// só pra criar uma Checkout Session e ler ela de volta.
const STRIPE_API = "https://api.stripe.com/v1";

function stripeHeaders() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe não configurado (falta STRIPE_SECRET_KEY)");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

export async function createCheckoutSession(params: {
  priceId: string;
  plano: string;
  nomeNegocio: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": params.priceId,
    "line_items[0][quantity]": "1",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    "subscription_data[trial_period_days]": "14",
    "metadata[nome_negocio]": params.nomeNegocio,
    "metadata[plano]": params.plano,
  });

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: stripeHeaders(),
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao criar checkout");
  }
  return data as { id: string; url: string };
}

// Pix pra cobrar sinal de serviço de ticket alto direto na conversa do
// WhatsApp. PRECISA que Pix esteja ativado no dashboard da Stripe
// (Configurações > Pagamentos) — não é algo que dá pra ligar por API,
// é uma habilitação manual da conta. Sem isso, a Stripe recusa com
// "payment method type pix is invalid".
export async function createPixPaymentIntent(params: {
  valorCentavos: number;
  descricao: string;
}) {
  const body = new URLSearchParams({
    amount: String(params.valorCentavos),
    currency: "brl",
    "payment_method_types[]": "pix",
    "payment_method_data[type]": "pix",
    confirm: "true",
    description: params.descricao,
  });

  const res = await fetch(`${STRIPE_API}/payment_intents`, {
    method: "POST",
    headers: stripeHeaders(),
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao gerar cobrança Pix");
  }

  const qr = data?.next_action?.pix_display_qr_code;
  if (!qr?.data) {
    throw new Error("Stripe não devolveu o código Pix — confere se Pix está ativado no dashboard");
  }

  return {
    paymentIntentId: data.id as string,
    pixCopiaECola: qr.data as string,
    expiresAt: qr.expires_at as number | undefined,
  };
}

// Portal de cobrança hospedado pela própria Stripe — é onde o dono troca
// de plano, atualiza cartão ou Pix e vê faturas, sem a gente jamais tocar
// em dado de pagamento. Precisa que o Portal esteja configurado no
// dashboard da Stripe (Configurações > Billing > Customer portal) com os
// 3 preços dos planos liberados pra troca — habilitação manual, não dá
// pra ligar por API.
export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  const body = new URLSearchParams({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  const res = await fetch(`${STRIPE_API}/billing_portal/sessions`, {
    method: "POST",
    headers: stripeHeaders(),
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao abrir o portal de cobrança");
  }
  return data as { id: string; url: string };
}

// Lê a assinatura ativa (ou em trial) do cliente na Stripe e devolve o
// price id em uso — chamado quando o dono volta do Portal de cobrança,
// já que trocar de plano por lá não avisa a gente de outra forma (sem
// webhook configurado, mesmo padrão do getCheckoutSession).
export async function getPriceIdAtivo(customerId: string): Promise<string | null> {
  const params = new URLSearchParams({
    customer: customerId,
    status: "all",
    limit: "5",
  });
  const res = await fetch(`${STRIPE_API}/subscriptions?${params}`, {
    headers: stripeHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao consultar assinatura");
  }

  const assinaturas = (data?.data ?? []) as {
    status: string;
    items?: { data?: { price?: { id?: string } }[] };
  }[];
  const ativa = assinaturas.find((s) => s.status === "active" || s.status === "trialing");
  return ativa?.items?.data?.[0]?.price?.id ?? null;
}

export async function getCheckoutSession(sessionId: string) {
  // Sem expand: "customer" vem só como o id ("cus_...") mesmo, que é tudo
  // que a gente guarda. Expandir devolveria o objeto Customer inteiro e
  // faria esse id virar um JSON gigante em vez do texto simples que as
  // colunas stripe_customer_id esperam.
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${sessionId}`, {
    headers: stripeHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao ler checkout");
  }
  return data as {
    id: string;
    customer_email?: string;
    customer_details?: { email?: string };
    customer?: string;
    subscription?: string;
    metadata?: { nome_negocio?: string; plano?: string };
    payment_status: string;
  };
}

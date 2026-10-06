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

// ui_mode "embedded": o formulário de cartão da Stripe fica montado dentro
// da nossa própria página (app.ivva.app.br/planos) em vez de redirecionar
// pro domínio checkout.stripe.com — mesma conformidade PCI, mas o cliente
// nunca sai da cara do site. Por isso é client_secret, não url, e o
// destino final é return_url (sem cancel_url separado).
export async function createCheckoutSession(params: {
  priceId: string;
  plano: string;
  nomeNegocio: string;
  returnUrl: string;
  /** E-mail já informado no cadastro: vem preenchido (e travado) no pagamento. */
  email?: string;
  /** Dados do cadastro (nome, telefone, tipo de negócio) guardados na sessão. */
  extraMetadata?: Record<string, string>;
}) {
  const body = new URLSearchParams({
    mode: "subscription",
    ui_mode: "embedded_page",
    "line_items[0][price]": params.priceId,
    "line_items[0][quantity]": "1",
    return_url: params.returnUrl,
    "subscription_data[trial_period_days]": "14",
    // Teste de 14 dias SEM cartão: a Stripe só pede o cartão quando houver cobrança. Se o teste acabar sem cartão
    // cadastrado, a assinatura é cancelada (o webhook bloqueia o acesso) em vez de ficar cobrando em falso.
    payment_method_collection: "if_required",
    "subscription_data[trial_settings][end_behavior][missing_payment_method]": "cancel",
    "metadata[nome_negocio]": params.nomeNegocio,
    "metadata[plano]": params.plano,
  });
  if (params.email) body.set("customer_email", params.email);
  for (const [k, v] of Object.entries(params.extraMetadata ?? {})) {
    if (v) body.set(`metadata[${k}]`, v.slice(0, 480));
  }

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: stripeHeaders(),
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao criar checkout");
  }
  return data as { id: string; client_secret: string };
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

// Cancela toda assinatura ativa/em trial do cliente, imediatamente (sem
// esperar o fim do período já pago) — usada só no fluxo de "apagar
// conta", pra garantir que ninguém continue sendo cobrado depois que os
// dados já foram todos apagados do banco.
export async function cancelarAssinaturasAtivas(customerId: string): Promise<void> {
  const params = new URLSearchParams({ customer: customerId, status: "all", limit: "10" });
  const res = await fetch(`${STRIPE_API}/subscriptions?${params}`, {
    headers: stripeHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao consultar assinaturas pra cancelar");
  }

  const assinaturas = (data?.data ?? []) as { id: string; status: string }[];
  const ativas = assinaturas.filter((s) => s.status === "active" || s.status === "trialing");

  for (const assinatura of ativas) {
    const res = await fetch(`${STRIPE_API}/subscriptions/${assinatura.id}`, {
      method: "DELETE",
      headers: stripeHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message ?? "Falha ao cancelar assinatura");
    }
  }
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
    metadata?: { nome_negocio?: string; plano?: string; tipo?: string; tenant_id?: string; nome?: string; segmento?: string; telefone?: string };
    payment_status: string;
    amount_total?: number;
  };
}

// Pacote avulso de conversas com a IA: pagamento único (não é assinatura). Cobra por
// price_data, então não precisa de produto cadastrado no painel da Stripe. A conferência do
// pagamento é feita ao voltar (e depois por reconciliarCreditos), sem depender de webhook novo.
export async function createCreditosCheckoutSession(params: {
  customerId: string | null;
  tenantId: string;
  conversas: number;
  valorCentavos: number;
  successUrl: string;
  cancelUrl: string;
}) {
  const body = new URLSearchParams({
    mode: "payment",
    locale: "pt-BR",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": String(params.valorCentavos),
    "line_items[0][price_data][product_data][name]": `ivva · +${params.conversas} conversas com a IA`,
    "line_items[0][price_data][product_data][description]":
      "Crédito avulso: não expira e é usado depois das conversas do seu plano.",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    "metadata[tipo]": "creditos_conversas",
    "metadata[tenant_id]": params.tenantId,
    "metadata[conversas]": String(params.conversas),
  });
  if (params.customerId) body.set("customer", params.customerId);

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: stripeHeaders(),
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao abrir o pagamento dos créditos");
  }
  return data as { id: string; url: string };
}

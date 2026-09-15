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

export async function getCheckoutSession(sessionId: string) {
  const res = await fetch(
    `${STRIPE_API}/checkout/sessions/${sessionId}?expand[]=customer`,
    { headers: stripeHeaders() },
  );
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

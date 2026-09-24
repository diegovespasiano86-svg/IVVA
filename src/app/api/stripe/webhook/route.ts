import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// A Stripe assina todo POST com HMAC-SHA256 do corpo bruto + timestamp,
// usando o signing secret gerado ao registrar o endpoint no dashboard.
// Tolerância de 5 minutos contra replay, igual à recomendação oficial.
function assinaturaValida(rawBody: string, assinaturaHeader: string | null): boolean {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET;
  if (!webhookSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SIGNING_SECRET não configurado — recusando por segurança");
    return false;
  }
  if (!assinaturaHeader) return false;

  const partes = Object.fromEntries(
    assinaturaHeader.split(",").map((par) => par.split("=") as [string, string]),
  );
  const timestamp = partes.t;
  const assinaturaRecebida = partes.v1;
  if (!timestamp || !assinaturaRecebida) return false;

  const idadeSegundos = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (idadeSegundos > 300) return false;

  const payloadAssinado = `${timestamp}.${rawBody}`;
  const esperada = createHmac("sha256", webhookSecret).update(payloadAssinado, "utf8").digest("hex");

  const a = Buffer.from(esperada, "hex");
  const b = Buffer.from(assinaturaRecebida, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type StripeEvent = {
  type: string;
  data: {
    object: {
      customer?: string;
      status?: string;
    };
  };
};

// Eventos que mudam o status de uma assinatura — é isso que decide se o
// tenant fica travado (past_due/unpaid/incomplete_expired/canceled) ou
// liberado (active/trialing). Cancelamento pelo Portal (fim do período já
// pago) chega como customer.subscription.deleted na hora certa.
const EVENTOS_RELEVANTES = new Set([
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!assinaturaValida(rawBody, request.headers.get("stripe-signature"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  if (!EVENTOS_RELEVANTES.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const customerId = event.data.object.customer;
  const status = event.type === "customer.subscription.deleted" ? "canceled" : event.data.object.status;
  if (!customerId || !status) {
    return NextResponse.json({ received: true });
  }

  const internalSecret = process.env.STRIPE_WEBHOOK_INTERNAL_SECRET;
  if (!internalSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_INTERNAL_SECRET não configurado");
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { error } = await supabase.rpc("stripe_atualizar_status_assinatura", {
    p_secret: internalSecret,
    p_stripe_customer_id: customerId,
    p_status: status,
  });

  if (error) {
    console.error("[stripe webhook] falha ao atualizar status da assinatura:", error.message);
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

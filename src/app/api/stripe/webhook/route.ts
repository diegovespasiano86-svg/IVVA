import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emailConfigurado, emailContaExistente, enviarEmail } from "@/lib/email";

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
      id?: string;
      mode?: string;
      customer?: string;
      status?: string;
      customer_email?: string | null;
      customer_details?: { email?: string | null } | null;
      metadata?: { nome_negocio?: string; plano?: string; tipo?: string } | null;
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

  // Pagamento da assinatura confirmado: registra o cadastro e avisa o cliente por e-mail, sem depender de ele
  // voltar à tela de boas-vindas (se fechar a aba ou cair em erro, ninguém fica pago e sem acesso).
  if (event.type === "checkout.session.completed") {
    return tratarCheckoutConcluido(event);
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

async function tratarCheckoutConcluido(event: StripeEvent) {
  const s = event.data.object;
  // Compra avulsa de créditos usa outro caminho; aqui só entra assinatura nova.
  if (s.mode !== "subscription" || s.metadata?.tipo === "creditos") {
    return NextResponse.json({ received: true });
  }
  const email = (s.customer_details?.email ?? s.customer_email ?? "").trim().toLowerCase();
  const internalSecret = process.env.STRIPE_WEBHOOK_INTERNAL_SECRET;
  if (!s.id || !email || !internalSecret) {
    console.error("[stripe webhook] checkout.session.completed sem dados suficientes", { id: s.id, temEmail: Boolean(email) });
    return NextResponse.json({ received: true });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const nome = s.metadata?.nome_negocio ?? "seu negócio";
  const plano = s.metadata?.plano ?? "essencial";

  const { data, error } = await supabase.rpc("cadastro_pendente_registrar", {
    p_secret: internalSecret,
    p_session_id: s.id,
    p_customer_id: s.customer ?? null,
    p_email: email,
    p_nome: nome,
    p_plano: plano,
  });
  if (error) {
    console.error("[stripe webhook] falha ao registrar cadastro pendente:", error.message);
    // 500 faz a Stripe tentar de novo (ela repete por até 3 dias).
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  // O lead (cadastro feito antes do pagamento) passa a "pago".
  await supabase.rpc("lead_pago", { p_secret: internalSecret, p_email: email, p_session_id: s.id });

  const resultado = data as { status: string; novo: boolean } | null;
  // Só a primeira entrega envia e-mail; repetições da Stripe não duplicam.
  if (resultado?.novo && emailConfigurado()) {
    let mensagem: { assunto: string; html: string; texto: string } | null = null;
    // Quem acabou de pagar já cai na tela de criar a senha (return_url); mandar o mesmo passo por e-mail só duplica.
    // Se a pessoa fechar a página sem criar o acesso, o alerta diário avisa a ivva (cadastros pendentes).
    if (resultado.status === "conta_existente") {
      mensagem = emailContaExistente({ email });
    }
    if (mensagem) {
      const envio = await enviarEmail({ para: email, ...mensagem });
      if (envio.ok) {
        await supabase.rpc("cadastro_pendente_email_enviado", { p_secret: internalSecret, p_session_id: s.id });
      }
    }
  }

  return NextResponse.json({ received: true });
}

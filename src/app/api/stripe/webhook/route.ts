import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  emailCancelamentoAgendado,
  emailConfigurado,
  emailContaExistente,
  emailPagamentoFalhou,
  emailTesteAcabando,
  enviarEmail,
} from "@/lib/email";

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
      cancel_at_period_end?: boolean;
      cancel_at?: number | null;
      current_period_end?: number;
      trial_end?: number | null;
      items?: { data?: { current_period_end?: number }[] };
      attempt_count?: number;
      subscription?: string | null;
    };
    previous_attributes?: { cancel_at_period_end?: boolean; cancel_at?: number | null };
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

  // Rescue: cancelamento agendado, cartão recusado e fim do teste viram e-mail (uma vez por evento).
  // Nunca derruba o webhook: se falhar, só registra no log.
  await tratarRescue(event).catch((err) => console.error("[stripe webhook] rescue", err instanceof Error ? err.message : err));

  if (event.type === "invoice.payment_failed" || event.type === "customer.subscription.trial_will_end") {
    return NextResponse.json({ received: true });
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

type DadosRescue = {
  negocio: string | null;
  plano: string | null;
  dono_nome: string | null;
  dono_email: string | null;
  preenchido: boolean;
  conversas_30d: number;
  agendamentos_30d: number;
};

const dataCurta = (segundos: number | null | undefined) =>
  segundos ? new Date(segundos * 1000).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null;

async function tratarRescue(event: StripeEvent) {
  const o = event.data.object;
  const prev = event.data.previous_attributes;
  let tipo: "cancelamento_agendado" | "pagamento_falhou" | "teste_acabando" | null = null;
  let chave = "";
  let fim: string | null = null;

  if (event.type === "customer.subscription.updated" && (o.cancel_at_period_end || o.cancel_at)) {
    // Só quando o cancelamento acabou de ser marcado (não a cada atualização da assinatura já marcada).
    const acabouDeMarcar = (prev && "cancel_at_period_end" in prev && !prev.cancel_at_period_end) || (prev && "cancel_at" in prev && !prev.cancel_at);
    if (!acabouDeMarcar) return;
    tipo = "cancelamento_agendado";
    const fimSeg = o.cancel_at ?? o.current_period_end ?? o.items?.data?.[0]?.current_period_end;
    chave = `cancelamento:${o.id}:${fimSeg ?? ""}`;
    fim = dataCurta(fimSeg);
  } else if (event.type === "invoice.payment_failed") {
    // Um e-mail por fatura, na primeira recusa; as novas tentativas da Stripe não repetem o aviso.
    tipo = "pagamento_falhou";
    chave = `falha:${o.id}`;
  } else if (event.type === "customer.subscription.trial_will_end") {
    tipo = "teste_acabando";
    chave = `teste:${o.id}:${o.trial_end ?? ""}`;
    fim = dataCurta(o.trial_end);
  }
  if (!tipo || !o.customer || !emailConfigurado()) return;

  const internalSecret = process.env.STRIPE_WEBHOOK_INTERNAL_SECRET;
  if (!internalSecret) return;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.rpc("rescue_evento_stripe", {
    p_secret: internalSecret,
    p_customer: o.customer,
    p_tipo: tipo,
    p_chave: chave,
    p_detalhe: { evento: event.type, fim },
  });
  if (error) throw new Error(error.message);
  const d = data as DadosRescue | null;
  // null = cliente desconhecido ou aviso repetido (já tratado).
  if (!d?.dono_email) return;

  const base = { nome: d.dono_nome, negocio: d.negocio };
  const resumo = { preenchido: d.preenchido, conversas_30d: Number(d.conversas_30d) || 0, agendamentos_30d: Number(d.agendamentos_30d) || 0 };
  const mensagem =
    tipo === "cancelamento_agendado"
      ? emailCancelamentoAgendado({ ...base, fim, ...resumo })
      : tipo === "pagamento_falhou"
        ? emailPagamentoFalhou(base)
        : emailTesteAcabando({ ...base, fim, plano: d.plano, ...resumo });
  await enviarEmail({ para: d.dono_email, ...mensagem });
}

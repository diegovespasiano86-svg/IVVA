import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emailConfigurado, emailFinalizarCadastro, enviarEmail } from "@/lib/email";
import { origemDoApp } from "@/lib/origem";

// Aviso do Asaas da PRÓPRIA ivva (mensalidades pagas no Pix). Autenticação: header "asaas-access-token" igual a
// ASAAS_IVVA_WEBHOOK_TOKEN (cadastrado no webhook, no painel do Asaas). Eventos usados:
//  PAYMENT_RECEIVED / PAYMENT_CONFIRMED -> libera e estende o período pago
//  PAYMENT_OVERDUE                       -> marca vencida (bloqueio só depois de 5 dias, no cron)
//  SUBSCRIPTION_DELETED / _INACTIVATED   -> cancelada (acesso até o fim do período pago)
// Repetições do mesmo aviso não mudam nada.
function tokenValido(recebido: string) {
  const esperado = process.env.ASAAS_IVVA_WEBHOOK_TOKEN ?? "";
  if (esperado.length < 32 || recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

export async function POST(req: Request) {
  if (!tokenValido(req.headers.get("asaas-access-token") ?? "")) return NextResponse.json({ ok: false }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) return NextResponse.json({ ok: false }, { status: 503 });

  let corpo: { event?: string; payment?: { subscription?: string | null; dueDate?: string }; subscription?: { id?: string } };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const evento = corpo.event ?? "";
  const supabase = createClient(url, anon);

  let erro: { message: string } | null = null;
  if (evento === "PAYMENT_RECEIVED" || evento === "PAYMENT_CONFIRMED") {
    const sub = corpo.payment?.subscription;
    if (!sub) return NextResponse.json({ ok: true }); // cobrança avulsa, não é mensalidade
    const { data, error } = await supabase.rpc("assinatura_pix_pago", {
      p_secret: secret,
      p_subscription: sub,
      p_vencimento: corpo.payment?.dueDate ?? null,
    });
    erro = error;
    // 1º pagamento: se a pessoa fechou a tela do Pix, o e-mail leva para criar o acesso.
    const r = data as { primeiro?: boolean; email?: string; ref?: string; nome_negocio?: string; plano?: string } | null;
    if (!error && r?.primeiro && r.email && r.ref && emailConfigurado()) {
      const link = `${await origemDoApp()}/bem-vindo?session_id=${r.ref}`;
      const envio = await enviarEmail({
        para: r.email,
        ...emailFinalizarCadastro({ negocio: r.nome_negocio ?? "seu negócio", plano: r.plano ?? "essencial", link, pix: true }),
      });
      if (!envio.ok) console.error("[asaas-ivva] e-mail de finalizar cadastro não saiu", r.email);
    }
  } else if (evento === "PAYMENT_OVERDUE") {
    const sub = corpo.payment?.subscription;
    if (!sub) return NextResponse.json({ ok: true });
    ({ error: erro } = await supabase.rpc("assinatura_pix_vencida", { p_secret: secret, p_subscription: sub }));
  } else if (evento === "SUBSCRIPTION_DELETED" || evento === "SUBSCRIPTION_INACTIVATED") {
    const sub = corpo.subscription?.id;
    if (!sub) return NextResponse.json({ ok: true });
    ({ error: erro } = await supabase.rpc("assinatura_pix_cancelada", { p_secret: secret, p_subscription: sub }));
  }

  if (erro) {
    console.error("[asaas-ivva] falha ao registrar", evento, erro.message);
    return NextResponse.json({ ok: false }, { status: 500 }); // o Asaas tenta de novo
  }
  return NextResponse.json({ ok: true });
}

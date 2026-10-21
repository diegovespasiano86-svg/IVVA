import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { desativarLink, lerContaAsaas } from "@/lib/asaas";

// Aviso do Asaas (conta do negócio) de que uma cobrança foi paga. Autenticação: header "asaas-access-token"
// com o token gerado para aquele negócio na conexão. Pagamento confirmado = baixa de estoque, comissão e relatórios
// (função cobranca_paga, a mesma regra do Checkout). Repetições do mesmo aviso são ignoradas.
const FORMA: Record<string, string> = { PIX: "pix", CREDIT_CARD: "credito", DEBIT_CARD: "debito" };

export async function POST(req: Request) {
  const token = req.headers.get("asaas-access-token") ?? "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) return NextResponse.json({ ok: false }, { status: 503 });
  if (token.length < 32) return NextResponse.json({ ok: false }, { status: 401 });

  const supabase = createClient(url, anon);
  const { data: tenantId } = await supabase.rpc("asaas_conta_por_token", { p_secret: secret, p_token: token });
  if (!tenantId) return NextResponse.json({ ok: false }, { status: 401 });

  let corpo: { event?: string; payment?: { id?: string; billingType?: string; pixQrCodeId?: string | null; paymentLink?: string | null } };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const evento = corpo.event ?? "";
  const pg = corpo.payment;
  if (!pg || (evento !== "PAYMENT_RECEIVED" && evento !== "PAYMENT_CONFIRMED")) return NextResponse.json({ ok: true });

  // A cobrança da ivva é identificada pelo QR estático, pelo link de pagamento ou, na falta deles, pela própria cobrança.
  const chaveCobranca = pg.pixQrCodeId || pg.paymentLink || pg.id;
  if (!chaveCobranca) return NextResponse.json({ ok: true });

  const { data, error } = await supabase.rpc("cobranca_paga", {
    p_secret: secret,
    p_asaas_id: chaveCobranca,
    p_forma: FORMA[pg.billingType ?? ""] ?? "pix",
  });
  if (error) {
    console.error("[asaas-webhook] cobranca_paga falhou", error.message);
    return NextResponse.json({ ok: false }, { status: 500 }); // o Asaas tenta de novo
  }
  const r = data as { ok: boolean; motivo?: string; sem_registro?: boolean; repetido?: boolean };
  if (r.sem_registro) console.error("[asaas-webhook] pago, mas a baixa falhou (ver cobrancas.erro)", chaveCobranca);

  // Link de uso único: desativa depois de pago.
  if (r.ok && !r.repetido && pg.paymentLink) {
    try {
      const conta = await lerContaAsaas(tenantId as string);
      if (conta) await desativarLink(conta, pg.paymentLink);
    } catch (e) {
      console.error("[asaas-webhook] não consegui desativar o link", e);
    }
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assinaturaValida, formaDoMP, lerContaMP, mp } from "@/lib/mercadopago";

// Aviso do Mercado Pago (um endereço para todos os negócios). Autenticação: assinatura x-signature com o segredo do app.
// Nunca confiamos no corpo do aviso: o pagamento é consultado na conta do próprio vendedor. Pago = baixa de estoque,
// comissão e relatórios (mesma regra do Asaas e do Checkout). Repetições do mesmo aviso são ignoradas.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret || !process.env.MERCADOPAGO_WEBHOOK_SECRET) return NextResponse.json({ ok: false }, { status: 503 });

  let corpo: { type?: string; topic?: string; user_id?: number | string; data?: { id?: string | number } } = {};
  try {
    corpo = await req.json();
  } catch {
    /* alguns avisos antigos vêm só na query */
  }
  const dataId = String(req.nextUrl.searchParams.get("data.id") ?? corpo.data?.id ?? "");
  const tipoBruto = corpo.type ?? req.nextUrl.searchParams.get("type") ?? corpo.topic ?? "";
  const tipo = tipoBruto.startsWith("order") ? "order" : tipoBruto; // o tópico de maquininha/Orders chega como "orders" ou "order"
  if (!dataId) return NextResponse.json({ ok: true });

  if (!assinaturaValida({ signature: req.headers.get("x-signature"), requestId: req.headers.get("x-request-id") }, dataId)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (tipo !== "payment" && tipo !== "order") return NextResponse.json({ ok: true });

  const supabase = createClient(url, anon);
  const usuarioMP = Number(corpo.user_id);
  if (!usuarioMP) {
    console.error("[mercadopago-webhook] aviso sem user_id, ignorado", tipo, dataId);
    return NextResponse.json({ ok: true });
  }
  const { data: tenantId } = await supabase.rpc("mp_conta_por_usuario", { p_secret: secret, p_user: usuarioMP });
  if (!tenantId) return NextResponse.json({ ok: true }); // negócio que não é da ivva

  let ref: string | null = null;
  let valor = 0;
  let forma: "pix" | "credito" | "debito" = "pix";
  try {
    const conta = await lerContaMP(tenantId as string);
    if (!conta) return NextResponse.json({ ok: true });
    if (tipo === "payment") {
      const p = await mp<{ status?: string; external_reference?: string | null; transaction_amount?: number; payment_type_id?: string }>(conta, `/v1/payments/${encodeURIComponent(dataId)}`);
      if (p.status !== "approved") return NextResponse.json({ ok: true });
      ref = p.external_reference ?? null;
      valor = Number(p.transaction_amount ?? 0);
      forma = formaDoMP(p.payment_type_id);
    } else {
      const o = await mp<{ status?: string; external_reference?: string | null; transactions?: { payments?: { status?: string; amount?: string; payment_method?: { type?: string } }[] } }>(conta, `/v1/orders/${encodeURIComponent(dataId)}`);
      const pg = o.transactions?.payments?.[0];
      if (o.status !== "processed" || (pg?.status && pg.status !== "processed")) return NextResponse.json({ ok: true });
      ref = o.external_reference ?? null;
      valor = Number(pg?.amount ?? 0);
      forma = formaDoMP(pg?.payment_method?.type);
    }
  } catch (e) {
    console.error("[mercadopago-webhook] consulta falhou", e);
    return NextResponse.json({ ok: false }, { status: 500 }); // o Mercado Pago tenta de novo
  }

  // Venda feita na maquininha sem passar pela ivva (ou de outro sistema): não há cobrança para dar baixa.
  if (!ref || !UUID.test(ref) || !(valor > 0)) return NextResponse.json({ ok: true });

  const { data, error } = await supabase.rpc("cobranca_paga_id", { p_secret: secret, p_id: ref, p_tenant: tenantId, p_valor: valor, p_forma: forma });
  if (error) {
    console.error("[mercadopago-webhook] cobranca_paga_id falhou", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const r = data as { ok: boolean; motivo?: string; sem_registro?: boolean };
  if (r.motivo === "valor_divergente") console.error("[mercadopago-webhook] valor pago diferente da cobrança", ref);
  if (r.sem_registro) console.error("[mercadopago-webhook] pago, mas a baixa falhou (ver cobrancas.erro)", ref);
  return NextResponse.json({ ok: true });
}

import { createClient } from "@supabase/supabase-js";
import { getCheckoutSession } from "./stripe";

// O pagamento que abre o cadastro pode vir de dois lugares, identificados pelo session_id de /bem-vindo:
//  - "cs_..." : Checkout da Stripe (cartão, com teste grátis)
//  - "pix_...": assinatura no Pix pelo Asaas da ivva (sem teste grátis), ver src/lib/asaas-ivva.ts
export type PagamentoCadastro = {
  pago: boolean;
  email: string;
  nome: string | null;
  nomeNegocio: string | null;
  segmento: string | null;
  plano: string | null;
  stripeCustomerId: string | null;
  pix: boolean;
};

export function ehRefPix(ref: string) {
  return /^pix_[0-9a-f]{32}$/.test(ref);
}

export async function lerPagamentoCadastro(ref: string): Promise<PagamentoCadastro> {
  if (ehRefPix(ref)) {
    const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
    if (!secret) throw new Error("configuração incompleta");
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.rpc("assinatura_pix_ler", { p_secret: secret, p_ref: ref });
    if (error || !data) throw new Error("assinatura pix não encontrada");
    const a = data as { email: string; nome: string | null; nome_negocio: string; segmento: string | null; plano: string; status: string };
    return {
      pago: a.status === "ativa" || a.status === "vencida",
      email: a.email,
      nome: a.nome || null,
      nomeNegocio: a.nome_negocio,
      segmento: a.segmento || null,
      plano: a.plano,
      stripeCustomerId: null,
      pix: true,
    };
  }

  const s = await getCheckoutSession(ref);
  return {
    pago: s.payment_status === "paid" || s.payment_status === "no_payment_required",
    email: (s.customer_details?.email ?? s.customer_email ?? "").trim().toLowerCase(),
    nome: s.metadata?.nome ?? null,
    nomeNegocio: s.metadata?.nome_negocio ?? null,
    segmento: s.metadata?.segmento ?? null,
    plano: s.metadata?.plano ?? null,
    stripeCustomerId: s.customer ?? null,
    pix: false,
  };
}

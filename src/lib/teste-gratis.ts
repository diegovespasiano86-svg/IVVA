import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCheckoutSession } from "./stripe";
import { PRECO_MENSAL } from "./planos";

// IVVA BLACK sem cartão: 60 dias no Essencial. O cartão (R$ 0 hoje) é cadastrado durante o período;
// sem ele, a IA para no fim (trava no banco, ia_consumir_conversa).
export const TESTE_GRATIS = {
  dias: 60,
  plano: "essencial" as const,
  /** Cadastros aceitos até aqui (fim da campanha, horário de Brasília). */
  inscricoesAte: Date.parse("2027-01-01T00:00:00-03:00"),
  /** Marca no cadastro de quem entrou por este caminho. */
  origem: "black60",
};

export type TesteGratis = { fim: string; cartao_em: string | null };

/** Período grátis sem cartão do negócio logado (null para quem entrou por outro caminho). */
export async function lerTesteGratis(supabase: SupabaseClient, tenantId: string): Promise<TesteGratis | null> {
  const { data } = await supabase.from("testes_gratis").select("fim, cartao_em").eq("tenant_id", tenantId).maybeSingle();
  return (data as TesteGratis | null) ?? null;
}

export const dataBr = (d: string | number) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const DUAS_HORAS_DE_FOLGA = 50 * 60 * 60 * 1000; // a Stripe exige o fim do teste pelo menos 48 h à frente

/** Pagamento hospedado na Stripe só para guardar o cartão: nada é cobrado antes do fim do período grátis. */
export async function abrirCadastroDoCartao(p: { tenantId: string; email: string; fim: string; origem: string }): Promise<string> {
  const chave = process.env.STRIPE_SECRET_KEY;
  const preco = process.env.STRIPE_PRICE_ESSENCIAL;
  if (!chave || !preco) throw new Error("Stripe não configurado");
  const fim = Date.parse(p.fim);
  const body = new URLSearchParams({
    mode: "subscription",
    locale: "pt-BR",
    "line_items[0][price]": preco,
    "line_items[0][quantity]": "1",
    "payment_method_types[0]": "card",
    customer_email: p.email,
    success_url: `${p.origem}/assinatura/cartao/ok?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${p.origem}/assinatura`,
    "metadata[tipo]": "cartao_teste",
    "metadata[tenant_id]": p.tenantId,
    "metadata[plano]": TESTE_GRATIS.plano,
  });
  if (fim > Date.now()) {
    const cobranca = Math.max(fim, Date.now() + DUAS_HORAS_DE_FOLGA);
    body.set("subscription_data[trial_end]", String(Math.floor(cobranca / 1000)));
    body.set("custom_text[submit][message]", `Hoje você paga R$ 0. A primeira cobrança de R$ ${PRECO_MENSAL.essencial} é em ${dataBr(cobranca)}. Cancele antes e não paga nada.`);
  }
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Falha ao abrir o cadastro do cartão");
  return data.url as string;
}

/** Confere na Stripe e liga o cartão ao negócio. Pode ser chamada duas vezes (retorno da tela e aviso da Stripe). */
export async function confirmarCartao(sessionId: string, tenantEsperado?: string): Promise<boolean> {
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return false;
  const s = (await getCheckoutSession(sessionId)) as Awaited<ReturnType<typeof getCheckoutSession>> & { status?: string };
  const tenantId = s.metadata?.tenant_id;
  if (s.metadata?.tipo !== "cartao_teste" || !tenantId || !s.customer) return false;
  if (tenantEsperado && tenantId !== tenantEsperado) return false;
  if (s.status !== "complete" || s.payment_status === "unpaid") return false;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await supabase.rpc("teste_gratis_ativar_cartao", { p_secret: secret, p_tenant_id: tenantId, p_customer: s.customer });
  if (error) throw new Error(error.message);
  return true;
}

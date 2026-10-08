"use server";

import { origemDoApp } from "@/lib/origem";

import { createClient } from "@supabase/supabase-js";
import { createCheckoutSession } from "@/lib/stripe";
import { getSegmento } from "@/lib/segmentos";

const PRICE_ENV: Record<string, string | undefined> = {
  essencial: process.env.STRIPE_PRICE_ESSENCIAL,
  profissional: process.env.STRIPE_PRICE_PROFISSIONAL,
  completo: process.env.STRIPE_PRICE_COMPLETO,
};

// Preços do ciclo anual (10x o mensal = 2 meses grátis). Só funciona quando as variáveis STRIPE_PRICE_*_ANUAL existem.
const PRICE_ENV_ANUAL: Record<string, string | undefined> = {
  essencial: process.env.STRIPE_PRICE_ESSENCIAL_ANUAL,
  profissional: process.env.STRIPE_PRICE_PROFISSIONAL_ANUAL,
  completo: process.env.STRIPE_PRICE_COMPLETO_ANUAL,
};

export type CadastroState = { erro: string | null; clientSecret: string | null };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Etapa de cadastro ANTES do pagamento. Grava o lead (nome, e-mail, WhatsApp, negócio, tipo) para que quem
 * desistir no meio possa ser reencontrado, avisa se o e-mail já tem conta (evita pagar à toa) e só então abre
 * o pagamento, com o e-mail já preenchido.
 */
export async function iniciarCadastro(_prev: CadastroState, formData: FormData): Promise<CadastroState> {
  const plano = String(formData.get("plano") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const nomeNegocio = String(formData.get("nome_negocio") ?? "").trim();
  const segmento = String(formData.get("segmento") ?? "").trim();
  const aceite = formData.get("aceite") === "on";
  const anual = String(formData.get("ciclo") ?? "") === "anual";

  if (nome.length < 2) return { erro: "Informe o seu nome.", clientSecret: null };
  if (!EMAIL_RE.test(email)) return { erro: "Confira o e-mail: parece incompleto.", clientSecret: null };
  if (telefone.replace(/\D/g, "").length < 10) return { erro: "Informe o WhatsApp com DDD, por exemplo (11) 99999-9999.", clientSecret: null };
  if (!nomeNegocio) return { erro: "Informe o nome do seu negócio.", clientSecret: null };
  if (!getSegmento(segmento)) return { erro: "Escolha o tipo do seu negócio.", clientSecret: null };
  if (!aceite) return { erro: "Para continuar, aceite os Termos e a Política de Privacidade.", clientSecret: null };

  const priceId = (anual ? PRICE_ENV_ANUAL : PRICE_ENV)[plano];
  if (!priceId) {
    return {
      erro: anual
        ? "O plano anual ainda está sendo liberado. Escolha o plano mensal por enquanto ou volte em instantes."
        : "Pagamento ainda em configuração. Volte em instantes.",
      clientSecret: null,
    };
  }

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return { erro: "Cadastro indisponível no momento. Tente de novo em instantes.", clientSecret: null };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data, error } = await supabase.rpc("lead_registrar", {
    p_secret: secret,
    p_nome: nome,
    p_email: email,
    p_telefone: telefone,
    p_nome_negocio: nomeNegocio,
    p_segmento: segmento,
    p_plano: plano,
  });
  if (error) {
    console.error("[cadastro] lead_registrar falhou", error.message);
    return { erro: "Não consegui registrar o seu cadastro. Confira os dados e tente de novo.", clientSecret: null };
  }
  if ((data as { tem_conta?: boolean } | null)?.tem_conta) {
    return {
      erro: "Já existe uma conta da ivva com esse e-mail. Entre em app.ivva.app.br/login, ou use outro e-mail para criar um novo negócio.",
      clientSecret: null,
    };
  }

  // Em produção o retorno da Stripe é sempre o endereço oficial do app.
  const origin = await origemDoApp();

  try {
    const session = await createCheckoutSession({
      priceId,
      plano,
      nomeNegocio,
      email,
      extraMetadata: { nome, segmento, telefone: telefone.replace(/\D/g, ""), ciclo: anual ? "anual" : "mensal" },
      returnUrl: `${origin}/bem-vindo?session_id={CHECKOUT_SESSION_ID}`,
    });
    await supabase.rpc("lead_avancar", { p_secret: secret, p_email: email, p_status: "pagamento_aberto", p_session_id: session.id });
    return { erro: null, clientSecret: session.client_secret };
  } catch (err) {
    console.error("[cadastro] falha ao abrir o pagamento", err);
    return { erro: "Não foi possível abrir o pagamento agora. Tente de novo em instantes.", clientSecret: null };
  }
}

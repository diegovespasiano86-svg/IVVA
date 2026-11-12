"use server";

import { createClient } from "@supabase/supabase-js";
import { origemDoApp } from "@/lib/origem";
import { createCheckoutSession } from "@/lib/stripe";
import { getSegmento } from "@/lib/segmentos";
import { FUNDADORES, MENSAGEM_PAGAMENTO } from "./regras";

export type FundadorState = { erro: string | null; clientSecret: string | null };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Cadastro do programa Fundadores: grava o lead e abre o checkout da Stripe com cobrança só em 13/02/2027. */
export async function iniciarCadastroFundador(_prev: FundadorState, formData: FormData): Promise<FundadorState> {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const nomeNegocio = String(formData.get("nome_negocio") ?? "").trim();
  const segmento = String(formData.get("segmento") ?? "").trim();
  const aceite = formData.get("aceite") === "on";
  const aceiteCobranca = formData.get("aceite_cobranca") === "on";

  if (Date.now() / 1000 > FUNDADORES.trialEnd - 3600) return { erro: "O programa Fundadores foi encerrado.", clientSecret: null };
  if (nome.length < 2) return { erro: "Informe o seu nome.", clientSecret: null };
  if (!EMAIL_RE.test(email)) return { erro: "Confira o e-mail: parece incompleto.", clientSecret: null };
  if (telefone.replace(/\D/g, "").length < 10) return { erro: "Informe o WhatsApp com DDD, por exemplo (11) 99999-9999.", clientSecret: null };
  if (!nomeNegocio) return { erro: "Informe o nome do seu negócio.", clientSecret: null };
  if (!getSegmento(segmento)) return { erro: "Escolha o tipo do seu negócio.", clientSecret: null };
  if (!aceite) return { erro: "Para continuar, aceite o Contrato, os Termos e a Política de Privacidade.", clientSecret: null };
  if (!aceiteCobranca) return { erro: `Para continuar, confirme que entendeu a cobrança a partir de ${FUNDADORES.primeiraCobranca}.`, clientSecret: null };

  const priceId = process.env.STRIPE_PRICE_COMPLETO;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!priceId || !secret) return { erro: "Cadastro indisponível no momento. Tente de novo em instantes.", clientSecret: null };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data, error } = await supabase.rpc("lead_registrar", {
    p_secret: secret,
    p_nome: nome,
    p_email: email,
    p_telefone: telefone,
    p_nome_negocio: nomeNegocio,
    p_segmento: segmento,
    p_plano: FUNDADORES.plano,
  });
  if (error) {
    console.error("[fundadores] lead_registrar falhou", error.message);
    return { erro: "Não consegui registrar o seu cadastro. Confira os dados e tente de novo.", clientSecret: null };
  }
  if ((data as { tem_conta?: boolean } | null)?.tem_conta) {
    return { erro: "Já existe uma conta da ivva com esse e-mail. Entre em app.ivva.app.br/login ou use outro e-mail.", clientSecret: null };
  }
  try {
    await supabase.rpc("lead_origem", { p_secret: secret, p_email: email, p_origem: { programa: "fundadores", whatsapp: "nao" } });
  } catch (e) {
    console.error("[fundadores] lead_origem falhou", e);
  }

  try {
    const origin = await origemDoApp();
    const session = await createCheckoutSession({
      priceId,
      plano: FUNDADORES.plano,
      nomeNegocio,
      email,
      extraMetadata: { nome, segmento, telefone: telefone.replace(/\D/g, ""), ciclo: "mensal", programa: "fundadores" },
      returnUrl: `${origin}/bem-vindo?session_id={CHECKOUT_SESSION_ID}`,
      trialEnd: FUNDADORES.trialEnd,
      somenteCartao: true,
      mensagemPagamento: MENSAGEM_PAGAMENTO,
    });
    await supabase.rpc("lead_avancar", { p_secret: secret, p_email: email, p_status: "pagamento_aberto", p_session_id: session.id });
    return { erro: null, clientSecret: session.client_secret };
  } catch (err) {
    console.error("[fundadores] falha ao abrir o pagamento", err);
    return { erro: "Não foi possível abrir o pagamento agora. Tente de novo em instantes.", clientSecret: null };
  }
}

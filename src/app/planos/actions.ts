"use server";

import { origemDoApp } from "@/lib/origem";

import { createClient } from "@supabase/supabase-js";
import { createCheckoutSession, garantirCupomIndicado } from "@/lib/stripe";
import { getSegmento } from "@/lib/segmentos";
import { PRECO_MENSAL, type PlanoId } from "@/lib/planos";
import {
  cobrancaPaga,
  cpfCnpjValido,
  criarAssinaturaPix,
  novaRefPix,
  pixAssinaturaConfigurada,
  removerAssinatura,
  type PixGerado,
} from "@/lib/asaas-ivva";
import type { Ambiente } from "@/lib/asaas";

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
  if (!aceite) return { erro: "Para continuar, aceite o Contrato, os Termos e a Política de Privacidade.", clientSecret: null };

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

  // Origem do cadastro (UTM/site de origem): só texto curto, guardado no lead. Falha aqui nunca impede o cadastro.
  try {
    const bruto = JSON.parse(String(formData.get("origem") ?? "{}")) as Record<string, unknown>;
    const origem: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer"]) {
      if (typeof bruto[k] === "string" && bruto[k]) origem[k] = (bruto[k] as string).slice(0, 80);
    }
    if (Object.keys(origem).length) await supabase.rpc("lead_origem", { p_secret: secret, p_email: email, p_origem: origem });
  } catch (e) {
    console.error("[cadastro] lead_origem falhou", e);
  }

  // Indique e ganhe: guarda a indicação (código do link de quem indicou). Falha aqui nunca impede o cadastro.
  let cupom: string | undefined;
  const refCodigo = String(formData.get("ref") ?? "").trim();
  if (refCodigo && /^[A-Za-z0-9]{3,20}$/.test(refCodigo)) {
    try {
      const { data: ind } = await supabase.rpc("indicacao_registrar", { p_secret: secret, p_codigo: refCodigo, p_email: email });
      // Indicado por código válido, em plano mensal: 10% na primeira mensalidade.
      if ((ind as { ok?: boolean } | null)?.ok && !anual) cupom = await garantirCupomIndicado();
    } catch (e) {
      console.error("[cadastro] indicacao_registrar falhou", e);
    }
  }

  // Em produção o retorno da Stripe é sempre o endereço oficial do app.
  const origin = await origemDoApp();

  try {
    const session = await createCheckoutSession({
      priceId,
      plano,
      nomeNegocio,
      cupom,
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

// ---- Assinatura paga no Pix (Asaas da ivva), sem teste grátis -------------------------------------------------

export type CadastroPixState = { erro: string | null; ref: string | null; pix: PixGerado | null; valor: number | null };

/**
 * Mesmo cadastro do cartão (lead gravado antes do pagamento), mais CPF/CNPJ, que o Asaas exige para cobrar.
 * Cria a assinatura no Asaas com a 1ª cobrança vencendo hoje e devolve o Pix dela. O acesso só é criado depois
 * do pagamento (webhook do Asaas ou conferência em situacaoPix).
 */
export async function iniciarCadastroPix(_prev: CadastroPixState, formData: FormData): Promise<CadastroPixState> {
  const falha = (erro: string): CadastroPixState => ({ erro, ref: null, pix: null, valor: null });
  const plano = String(formData.get("plano") ?? "") as PlanoId;
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const nomeNegocio = String(formData.get("nome_negocio") ?? "").trim();
  const segmento = String(formData.get("segmento") ?? "").trim();
  const aceite = formData.get("aceite") === "on";
  const anual = String(formData.get("ciclo") ?? "") === "anual";
  const cpfCnpj = cpfCnpjValido(String(formData.get("cpf_cnpj") ?? ""));

  if (!pixAssinaturaConfigurada()) return falha("O pagamento no Pix ainda não está disponível. Use o cartão ou volte em instantes.");
  if (!PRECO_MENSAL[plano]) return falha("Escolha um plano.");
  if (nome.length < 2) return falha("Informe o seu nome.");
  if (!EMAIL_RE.test(email)) return falha("Confira o e-mail: parece incompleto.");
  if (telefone.replace(/\D/g, "").length < 10) return falha("Informe o WhatsApp com DDD, por exemplo (11) 99999-9999.");
  if (!nomeNegocio) return falha("Informe o nome do seu negócio.");
  if (!getSegmento(segmento)) return falha("Escolha o tipo do seu negócio.");
  if (!cpfCnpj) return falha("Confira o CPF ou CNPJ: os números não conferem.");
  if (!aceite) return falha("Para continuar, aceite o Contrato, os Termos e a Política de Privacidade.");

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return falha("Cadastro indisponível no momento. Tente de novo em instantes.");
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
    console.error("[cadastro-pix] lead_registrar falhou", error.message);
    return falha("Não consegui registrar o seu cadastro. Confira os dados e tente de novo.");
  }
  if ((data as { tem_conta?: boolean } | null)?.tem_conta) {
    return falha("Já existe uma conta da ivva com esse e-mail. Entre em app.ivva.app.br/login, ou use outro e-mail para criar um novo negócio.");
  }

  try {
    const bruto = JSON.parse(String(formData.get("origem") ?? "{}")) as Record<string, unknown>;
    const origem: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer"]) {
      if (typeof bruto[k] === "string" && bruto[k]) origem[k] = (bruto[k] as string).slice(0, 80);
    }
    origem.pagamento = "pix";
    await supabase.rpc("lead_origem", { p_secret: secret, p_email: email, p_origem: origem });
  } catch (e) {
    console.error("[cadastro-pix] lead_origem falhou", e);
  }

  // Indicação fica registrada (o desconto de 10% é só no cartão mensal).
  const refCodigo = String(formData.get("ref") ?? "").trim();
  if (refCodigo && /^[A-Za-z0-9]{3,20}$/.test(refCodigo)) {
    try {
      await supabase.rpc("indicacao_registrar", { p_secret: secret, p_codigo: refCodigo, p_email: email });
    } catch (e) {
      console.error("[cadastro-pix] indicacao_registrar falhou", e);
    }
  }

  // Tentativa anterior do mesmo e-mail sem pagamento: cancela no Asaas para não ficar cobrança duplicada.
  const { data: antigas } = await supabase.rpc("assinatura_pix_pendentes", { p_secret: secret, p_email: email });
  for (const a of (antigas ?? []) as { asaas_subscription_id: string; ambiente: Ambiente }[]) {
    try {
      await removerAssinatura(a.asaas_subscription_id, a.ambiente);
    } catch (e) {
      console.error("[cadastro-pix] não consegui remover assinatura antiga", a.asaas_subscription_id, e);
    }
  }

  const valor = anual ? PRECO_MENSAL[plano] * 10 : PRECO_MENSAL[plano];
  const nomePlano = plano.charAt(0).toUpperCase() + plano.slice(1);
  const ref = novaRefPix();
  try {
    const r = await criarAssinaturaPix({
      ref,
      nome,
      email,
      telefone,
      cpfCnpj,
      nomeNegocio,
      valor,
      anual,
      descricao: `ivva - Plano ${nomePlano} (${anual ? "anual" : "mensal"}) - ${nomeNegocio}`,
    });
    const { error: errReg } = await supabase.rpc("assinatura_pix_registrar", {
      p_secret: secret,
      p_ref: ref,
      p_email: email,
      p_nome: nome,
      p_telefone: telefone,
      p_nome_negocio: nomeNegocio,
      p_segmento: segmento,
      p_plano: plano,
      p_ciclo: anual ? "anual" : "mensal",
      p_cpf_cnpj: cpfCnpj,
      p_valor: valor,
      p_ambiente: r.ambiente,
      p_customer: r.clienteId,
      p_subscription: r.assinaturaId,
      p_primeira_cobranca: r.cobrancaId,
    });
    if (errReg) {
      console.error("[cadastro-pix] assinatura_pix_registrar falhou", errReg.message);
      try {
        await removerAssinatura(r.assinaturaId, r.ambiente);
      } catch {}
      return falha("Não foi possível gerar o Pix agora. Tente de novo em instantes.");
    }
    await supabase.rpc("lead_avancar", { p_secret: secret, p_email: email, p_status: "pagamento_aberto", p_session_id: ref });
    return { erro: null, ref, pix: r.pix, valor };
  } catch (err) {
    console.error("[cadastro-pix] falha ao criar a assinatura no Asaas", err);
    const msg = err instanceof Error && err.message.startsWith("O Asaas recusou") ? ` (${err.message})` : "";
    return falha(`Não foi possível gerar o Pix agora. Tente de novo em instantes.${msg}`);
  }
}

/**
 * A tela do Pix pergunta a cada poucos segundos se o pagamento chegou. Normalmente o webhook do Asaas já marcou;
 * se ainda não, confere a cobrança direto no Asaas e marca (o pagamento nunca fica preso esperando o aviso).
 */
export async function situacaoPix(ref: string): Promise<"pago" | "aguardando" | "invalido"> {
  if (!/^pix_[0-9a-f]{32}$/.test(ref)) return "invalido";
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return "aguardando";
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase.rpc("assinatura_pix_ler", { p_secret: secret, p_ref: ref });
  const a = data as { status: string; ambiente: Ambiente; primeira_cobranca: string | null; subscription: string } | null;
  if (!a) return "invalido";
  if (a.status === "ativa" || a.status === "vencida") return "pago";
  if (a.status !== "aguardando_pagamento" || !a.primeira_cobranca) return "invalido";
  try {
    const c = await cobrancaPaga(a.primeira_cobranca, a.ambiente);
    if (!c.paga) return "aguardando";
    const { error } = await supabase.rpc("assinatura_pix_pago", { p_secret: secret, p_subscription: a.subscription, p_vencimento: c.vencimento });
    return error ? "aguardando" : "pago";
  } catch {
    return "aguardando";
  }
}

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCheckoutSession } from "@/lib/stripe";
import { getSegmento } from "@/lib/segmentos";

export async function finalizarCadastro(
  _prevState: string | undefined,
  formData: FormData,
) {
  const sessionId = String(formData.get("session_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const segmentoId = String(formData.get("segmento") ?? "").trim();

  if (!sessionId || !nome || senha.length < 6) {
    return "Preencha seu nome e uma senha com pelo menos 6 caracteres.";
  }
  if (!segmentoId) {
    return "Escolha o tipo do seu negócio antes de continuar.";
  }

  let session;
  try {
    session = await getCheckoutSession(sessionId);
  } catch {
    return "Não encontramos esse pagamento. Fale com a gente.";
  }

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return "Pagamento ainda não confirmado.";
  }

  const email = session.customer_details?.email ?? session.customer_email;
  const nomeNegocio = session.metadata?.nome_negocio ?? "Meu negócio";
  if (!email) {
    return "Não conseguimos ler o e-mail do pagamento.";
  }

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } =
    await supabase.auth.signUp({ email, password: senha });

  if (signUpError || !signUpData.user) {
    return signUpError?.message === "User already registered"
      ? "Já existe conta com esse e-mail. Faça login."
      : (signUpError?.message ?? "Falha ao criar sua conta.");
  }

  const plano = session.metadata?.plano ?? "essencial";

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) {
    return "Configuração do servidor incompleta. Fale com a gente.";
  }

  const segmento = getSegmento(segmentoId);

  const { error: rpcError } = await supabase.rpc("provision_tenant", {
    p_secret: secret,
    p_nome: nomeNegocio,
    p_plano: plano,
    p_stripe_customer_id: session.customer ?? null,
    p_user_id: signUpData.user.id,
    p_user_nome: nome,
    p_user_email: email,
    p_segmento: segmentoId,
    p_conhecimento_inicial: segmento?.baseConhecimento ?? null,
  });

  if (rpcError) {
    return "Conta criada, mas houve um problema ao configurar seu negócio. Fale com a gente.";
  }

  // Se o Supabase exige confirmação de e-mail, o signUp() acima não deixou
  // sessão ativa (cookies não foram setados). O provision_tenant já
  // confirmou o e-mail no banco, então um signIn explícito aqui resolve —
  // sem isso o middleware manda o usuário de volta pro /login mesmo com
  // tudo certo.
  await supabase.auth.signInWithPassword({ email, password: senha });

  redirect("/dashboard");
}

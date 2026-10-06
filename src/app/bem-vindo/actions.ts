"use server";

import { origemDoApp } from "@/lib/origem";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCheckoutSession } from "@/lib/stripe";
import { getSegmento } from "@/lib/segmentos";

export type EstadoCadastro = { erro: string | null; confirmar: string | null };

const ESTADO_ERRO = (erro: string): EstadoCadastro => ({ erro, confirmar: null });

function linkDeAtivacao(origem: string, sessionId: string) {
  const destino = `/bem-vindo/ativar?session_id=${encodeURIComponent(sessionId)}`;
  return `${origem}/auth/callback?next=${encodeURIComponent(destino)}`;
}

/**
 * Passo 1 do acesso: a pessoa cria a senha. O e-mail só é considerado dela depois que clicar no botão do
 * e-mail de confirmação da ivva; é esse clique que ativa o negócio (ver /bem-vindo/ativar). Por isso aqui
 * NÃO criamos o negócio: a tela passa a avisar que falta confirmar o e-mail.
 */
export async function finalizarCadastro(_prevState: EstadoCadastro | undefined, formData: FormData): Promise<EstadoCadastro> {
  const sessionId = String(formData.get("session_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const senha2 = String(formData.get("senha2") ?? "");
  const segmentoId = String(formData.get("segmento") ?? "").trim();

  if (!sessionId || !nome || senha.length < 8) {
    return ESTADO_ERRO("Preencha seu nome e uma senha com pelo menos 8 caracteres.");
  }
  if (senha !== senha2) {
    return ESTADO_ERRO("As duas senhas precisam ser iguais. Digite de novo.");
  }
  if (!segmentoId || !getSegmento(segmentoId)) {
    return ESTADO_ERRO("Escolha o tipo do seu negócio antes de continuar.");
  }

  let session;
  try {
    session = await getCheckoutSession(sessionId);
  } catch (err) {
    console.error("[cadastro] não leu o checkout", err instanceof Error ? err.message : err);
    return ESTADO_ERRO("Não encontramos esse pagamento. Fale com a gente e informe o código CAD-1.");
  }
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return ESTADO_ERRO("Pagamento ainda não confirmado.");
  }

  const email = (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
  if (!email) return ESTADO_ERRO("Não conseguimos ler o e-mail do pagamento.");

  const segredo = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!segredo) return ESTADO_ERRO("Configuração do servidor incompleta. Fale com a gente e informe o código CAD-2.");

  const supabase = await createClient();

  // Resto de uma tentativa anterior que ficou sem confirmar: limpa para a pessoa poder refazer.
  const { data: preparo } = await supabase.rpc("cadastro_preparar", { p_secret: segredo, p_email: email });
  if (preparo === "conta_existente") {
    return ESTADO_ERRO(`Já existe uma conta da ivva com o e-mail ${email}. Entre em app.ivva.app.br/login com ele, ou refaça o cadastro usando outro e-mail.`);
  }

  const origem = await origemDoApp();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { emailRedirectTo: linkDeAtivacao(origem, sessionId), data: { nome, segmento: segmentoId } },
  });
  if (error || !data.user) {
    console.error("[cadastro] falha no signUp", error?.message);
    return ESTADO_ERRO(
      `Não foi possível criar o seu acesso agora. Tente de novo em instantes. Se repetir, fale com a gente e informe o código CAD-4. (${error?.message ?? "sem detalhe"})`,
    );
  }
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return ESTADO_ERRO(`Já existe uma conta da ivva com o e-mail ${email}. Entre em app.ivva.app.br/login com ele, ou refaça o cadastro usando outro e-mail.`);
  }

  // Se o projeto estiver configurado sem confirmação de e-mail, já há sessão: ativa na hora.
  if (data.session) redirect(`/bem-vindo/ativar?session_id=${encodeURIComponent(sessionId)}`);

  return { erro: null, confirmar: email };
}

/** Reenvia o e-mail de confirmação (mesmo link de ativação). */
export async function reenviarConfirmacao(sessionId: string, email: string): Promise<{ ok: boolean; mensagem: string }> {
  if (!sessionId || !email) return { ok: false, mensagem: "Faltam dados para reenviar." };
  const supabase = await createClient();
  const origem = await origemDoApp();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: linkDeAtivacao(origem, sessionId) },
  });
  if (error) {
    console.error("[cadastro] falha ao reenviar confirmação", error.message);
    return { ok: false, mensagem: "Não consegui reenviar agora. Espere um minuto e tente de novo." };
  }
  return { ok: true, mensagem: "E-mail reenviado. Confira também a caixa de spam." };
}

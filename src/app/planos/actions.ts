"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createCheckoutSession } from "@/lib/stripe";

const PRICE_ENV: Record<string, string | undefined> = {
  essencial: process.env.STRIPE_PRICE_ESSENCIAL,
  profissional: process.env.STRIPE_PRICE_PROFISSIONAL,
  completo: process.env.STRIPE_PRICE_COMPLETO,
};

export async function assinarPlano(
  _prevState: string | undefined,
  formData: FormData,
) {
  const plano = String(formData.get("plano") ?? "");
  const nomeNegocio = String(formData.get("nome_negocio") ?? "").trim();

  if (!nomeNegocio) {
    return "Informe o nome do seu negócio.";
  }

  const priceId = PRICE_ENV[plano];
  if (!priceId) {
    return "Pagamento ainda em configuração — volta em instantes.";
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `https://${headerList.get("host") ?? "localhost:3000"}`;

  let session;
  try {
    session = await createCheckoutSession({
      priceId,
      plano,
      nomeNegocio,
      successUrl: `${origin}/bem-vindo?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/planos`,
    });
  } catch (err) {
    return err instanceof Error ? err.message : "Falha ao iniciar pagamento.";
  }

  redirect(session.url);
}

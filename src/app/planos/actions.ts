"use server";

import { headers } from "next/headers";
import { createCheckoutSession } from "@/lib/stripe";

const PRICE_ENV: Record<string, string | undefined> = {
  essencial: process.env.STRIPE_PRICE_ESSENCIAL,
  profissional: process.env.STRIPE_PRICE_PROFISSIONAL,
  completo: process.env.STRIPE_PRICE_COMPLETO,
};

export type AssinarPlanoState = { erro: string | null; clientSecret: string | null };

export async function assinarPlano(
  _prevState: AssinarPlanoState,
  formData: FormData,
): Promise<AssinarPlanoState> {
  const plano = String(formData.get("plano") ?? "");
  const nomeNegocio = String(formData.get("nome_negocio") ?? "").trim();

  if (!nomeNegocio) {
    return { erro: "Informe o nome do seu negócio.", clientSecret: null };
  }

  const priceId = PRICE_ENV[plano];
  if (!priceId) {
    return { erro: "Pagamento ainda em configuração — volta em instantes.", clientSecret: null };
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `https://${headerList.get("host") ?? "localhost:3000"}`;

  try {
    const session = await createCheckoutSession({
      priceId,
      plano,
      nomeNegocio,
      returnUrl: `${origin}/bem-vindo?session_id={CHECKOUT_SESSION_ID}`,
    });
    return { erro: null, clientSecret: session.client_secret };
  } catch (err) {
    return {
      erro: err instanceof Error ? err.message : "Falha ao iniciar pagamento.",
      clientSecret: null,
    };
  }
}

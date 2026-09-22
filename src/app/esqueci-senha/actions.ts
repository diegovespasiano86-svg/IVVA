"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type EsqueciSenhaState = { erro: string | null; enviado: boolean };

export async function solicitarRecuperacaoSenha(
  _prevState: EsqueciSenhaState,
  formData: FormData,
): Promise<EsqueciSenhaState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { erro: "Digite seu e-mail.", enviado: false };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const origin = headerList.get("origin") ?? `https://${headerList.get("host") ?? "localhost:3000"}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
  });

  // Nunca revela se o e-mail existe ou não na base — evita que alguém use
  // esse formulário pra descobrir quais e-mails têm conta na ivva. Sempre
  // mostra a mesma mensagem de sucesso, mesmo quando falha internamente.
  if (error) {
    console.error("[esqueci-senha] falha ao pedir recuperação", error);
  }

  return { erro: null, enviado: true };
}

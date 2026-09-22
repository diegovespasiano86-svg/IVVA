"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function redefinirSenha(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (senha.length < 6) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (senha !== confirmacao) {
    return "As senhas não são iguais.";
  }

  const supabase = await createClient();

  // A sessão aqui só existe porque o link do e-mail já passou pelo
  // /auth/callback e trocou o código por uma sessão de recuperação — sem
  // isso, updateUser não tem quem autenticar.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return "Link expirado ou inválido — peça a recuperação de novo.";
  }

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    return "Não consegui trocar sua senha. Tenta de novo.";
  }

  redirect("/dashboard");
}

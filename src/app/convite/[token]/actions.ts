"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function aceitarConvite(
  _prevState: string | undefined,
  formData: FormData,
) {
  const token = String(formData.get("token") ?? "");
  const senha = String(formData.get("senha") ?? "");

  if (!token || senha.length < 6) {
    return "Crie uma senha com pelo menos 6 caracteres.";
  }

  const supabase = await createClient();

  const { data: rpcInvite, error: inviteError } = await supabase
    .rpc("get_invite_public", { p_token: token })
    .maybeSingle();

  const invite = rpcInvite as {
    nome: string;
    email: string;
    tenant_nome: string;
    valido: boolean;
  } | null;

  if (inviteError || !invite || !invite.valido) {
    return "Convite inválido ou expirado. Peça um novo link.";
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password: senha,
  });

  if (signUpError || !signUpData.user) {
    return signUpError?.message === "User already registered"
      ? "Já existe conta com esse e-mail. Faça login."
      : (signUpError?.message ?? "Falha ao criar sua conta.");
  }

  const { error: rpcError } = await supabase.rpc("accept_invite", {
    p_token: token,
    p_user_id: signUpData.user.id,
  });

  if (rpcError) {
    return "Conta criada, mas houve um problema ao vincular você ao negócio. Fale com quem te convidou.";
  }

  // Mesmo motivo do /bem-vindo: se a confirmação de e-mail está exigida,
  // o signUp() não deixou sessão ativa. accept_invite já confirmou o
  // e-mail no banco, então um signIn explícito aqui garante a sessão.
  await supabase.auth.signInWithPassword({ email: invite.email, password: senha });

  redirect("/dashboard");
}

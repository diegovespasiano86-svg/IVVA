"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { origemDoApp } from "@/lib/origem";
import { criarWebhook, salvarContaAsaas, validarChave, type Ambiente } from "@/lib/asaas";

export type AsaasState = { ok: boolean; erro: string | null; aviso: string | null };

/** Conecta a conta Asaas do negócio: confere a chave, guarda criptografada e cria o aviso automático de pagamento. */
export async function conectarAsaas(_prev: AsaasState, formData: FormData): Promise<AsaasState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sua sessão expirou. Entre de novo.", aviso: null };
  const { data: perfil } = await supabase.from("users").select("tenant_id, role, email").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.role !== "dono") return { ok: false, erro: "Só o administrador conecta o Asaas.", aviso: null };

  const chave = String(formData.get("chave") ?? "").trim();
  const ambiente: Ambiente = formData.get("ambiente") === "sandbox" ? "sandbox" : "producao";
  if (!/^\$aact_[A-Za-z0-9_\-=.:$]{20,}$/.test(chave)) {
    return { ok: false, erro: "Essa chave não parece do Asaas. Ela começa com $aact_ e fica em Integrações > Chaves de API.", aviso: null };
  }

  try {
    await validarChave({ chave, ambiente });
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não consegui validar a chave.", aviso: null };
  }

  const token = randomBytes(32).toString("hex");
  try {
    await salvarContaAsaas(perfil.tenant_id, chave, ambiente, token);
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não consegui guardar a conexão.", aviso: null };
  }

  let aviso: string | null = null;
  try {
    await criarWebhook({ chave, ambiente }, `${await origemDoApp()}/api/asaas/webhook`, token, perfil.email ?? user.email ?? "contato@ivva.app.br");
  } catch {
    aviso = "Conectado, mas não consegui criar o aviso automático de pagamento no Asaas. Sem ele, a baixa não acontece sozinha: fale com o suporte da ivva.";
  }
  revalidatePath("/integracoes");
  revalidatePath("/checkout");
  return { ok: true, erro: null, aviso };
}

export async function desconectarAsaas() {
  const supabase = await createClient();
  await supabase.rpc("asaas_conta_remover");
  revalidatePath("/integracoes");
  revalidatePath("/checkout");
}

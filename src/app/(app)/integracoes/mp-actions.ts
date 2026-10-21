"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listarTerminaisMP, lerContaMP, type TerminalMP } from "@/lib/mercadopago";

async function donoDoNegocio() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("users").select("tenant_id, role").eq("id", user.id).maybeSingle();
  return perfil && perfil.role === "dono" ? { supabase, tenantId: perfil.tenant_id as string } : null;
}

export async function desconectarMercadoPago() {
  const d = await donoDoNegocio();
  if (!d) return;
  await d.supabase.rpc("mp_conta_remover");
  revalidatePath("/integracoes");
  revalidatePath("/checkout");
}

/** Busca as maquininhas Point da conta Mercado Pago conectada, para o dono escolher qual recebe as cobranças. */
export async function buscarMaquininhas(): Promise<{ erro: string | null; terminais: TerminalMP[] }> {
  const d = await donoDoNegocio();
  if (!d) return { erro: "Só o administrador escolhe a maquininha.", terminais: [] };
  try {
    const conta = await lerContaMP(d.tenantId);
    if (!conta) return { erro: "Conecte o Mercado Pago primeiro.", terminais: [] };
    const terminais = await listarTerminaisMP(conta);
    if (terminais.length === 0) return { erro: "Não encontramos nenhuma maquininha Point nessa conta.", terminais: [] };
    return { erro: null, terminais };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não consegui buscar as maquininhas.", terminais: [] };
  }
}

export async function escolherMaquininha(terminalId: string): Promise<{ erro: string | null }> {
  const d = await donoDoNegocio();
  if (!d) return { erro: "Só o administrador escolhe a maquininha." };
  const { error } = await d.supabase.rpc("mp_terminal_definir", { p_terminal: terminalId });
  if (error) return { erro: "Não consegui salvar a maquininha." };
  revalidatePath("/integracoes");
  revalidatePath("/checkout");
  return { erro: null };
}

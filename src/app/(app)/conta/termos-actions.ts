"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CHAVES_TERMOS, limparTermosPersonalizados, termosDoSegmento } from "@/lib/termos";

export type EstadoTermos = { erro: string | null; ok?: string };

/** Guarda o vocabulário personalizado do negócio (só o administrador). Valor igual ao padrão do nicho não é guardado. */
export async function salvarTermos(_prev: EstadoTermos, formData: FormData): Promise<EstadoTermos> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada, faça login de novo." };
  const { data: perfil } = await supabase.from("users").select("tenant_id, role, tenants(segmento)").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.role !== "dono") return { erro: "Só o administrador muda o vocabulário." };

  const restaurar = formData.get("acao") === "restaurar";
  const segmento = (perfil.tenants as unknown as { segmento: string | null } | null)?.segmento ?? null;
  const padrao = termosDoSegmento(segmento);

  let valor: Record<string, string> | null = null;
  if (!restaurar) {
    const bruto: Record<string, string> = {};
    for (const k of CHAVES_TERMOS) bruto[k] = String(formData.get(k) ?? "");
    const limpo = limparTermosPersonalizados(bruto);
    const diferentes = Object.fromEntries(Object.entries(limpo).filter(([k, v]) => v !== padrao[k as keyof typeof padrao]));
    valor = Object.keys(diferentes).length > 0 ? (diferentes as Record<string, string>) : null;
  }

  const { error } = await supabase.from("tenants").update({ termos: valor }).eq("id", perfil.tenant_id);
  if (error) return { erro: "Não consegui salvar agora. Tente de novo." };
  revalidatePath("/", "layout");
  return { erro: null, ok: restaurar || !valor ? "Vocabulário restaurado para o padrão do nicho." : "Vocabulário salvo. Já vale em todas as telas." };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarProduto(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const preco = Number(formData.get("preco") ?? 0);
  const estoqueAtual = Number(formData.get("estoque_atual") ?? 0);
  const estoqueMinimo = Number(formData.get("estoque_minimo") ?? 0);

  if (!nome) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return;

  await supabase.from("products").insert({
    tenant_id: perfil.tenant_id,
    nome,
    categoria: categoria || null,
    preco,
    estoque_atual: estoqueAtual,
    estoque_minimo: estoqueMinimo,
  });

  revalidatePath("/estoque");
}

export async function ajustarEstoque(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  if (!id || !delta) return;

  const supabase = await createClient();

  const { data: produto } = await supabase
    .from("products")
    .select("estoque_atual")
    .eq("id", id)
    .maybeSingle();
  if (!produto) return;

  const novoEstoque = Math.max(0, Number(produto.estoque_atual) + delta);

  await supabase
    .from("products")
    .update({ estoque_atual: novoEstoque })
    .eq("id", id);

  revalidatePath("/estoque");
}

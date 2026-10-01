"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CORES_ETIQUETA } from "@/lib/clientes";

// Etiquetas, listas e atribuição de conversa. O negócio vem sempre da sessão,
// e o banco (RLS + chaves compostas) recusa qualquer id de outro negócio.

type Sb = Awaited<ReturnType<typeof createClient>>;

async function sessao(): Promise<{ supabase: Sb; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

function mensagemDeErro(code: string | undefined, padrao: string) {
  if (code === "23505") return "Já existe um item com esse nome.";
  if (code === "23503") return "Esse item não pertence ao seu negócio.";
  return padrao;
}

export type Retorno = { erro: string | null };

// ---------- etiquetas ----------
export async function criarEtiqueta(_: Retorno | undefined, fd: FormData): Promise<Retorno> {
  const s = await sessao();
  if (!s) return { erro: "Sessão expirada. Entre de novo." };
  const nome = String(fd.get("nome") ?? "").trim().slice(0, 40);
  const cor = String(fd.get("cor") ?? "cinza");
  if (!nome) return { erro: "Dê um nome para a etiqueta." };
  if (!(CORES_ETIQUETA as readonly string[]).includes(cor)) return { erro: "Cor inválida." };
  const { error } = await s.supabase.from("labels").insert({ nome, cor });
  if (error) return { erro: mensagemDeErro(error.code, "Não foi possível criar a etiqueta.") };
  revalidatePath("/clientes/etiquetas");
  revalidatePath("/clientes");
  return { erro: null };
}

export async function excluirEtiqueta(fd: FormData) {
  const s = await sessao();
  const id = fd.get("id");
  if (!s || !ehUuid(id)) return;
  await s.supabase.from("labels").delete().eq("id", id);
  revalidatePath("/clientes/etiquetas");
  revalidatePath("/clientes");
}

export async function alternarEtiqueta(contactId: string, labelId: string, ativo: boolean): Promise<Retorno> {
  const s = await sessao();
  if (!s || !ehUuid(contactId) || !ehUuid(labelId)) return { erro: "Pedido inválido." };
  const { error } = ativo
    ? await s.supabase.from("contact_labels").upsert({ contact_id: contactId, label_id: labelId }, { onConflict: "contact_id,label_id", ignoreDuplicates: true })
    : await s.supabase.from("contact_labels").delete().eq("contact_id", contactId).eq("label_id", labelId);
  if (error) return { erro: mensagemDeErro(error.code, "Não foi possível atualizar a etiqueta.") };
  revalidatePath(`/clientes/${contactId}`);
  revalidatePath("/clientes");
  return { erro: null };
}

// ---------- listas ----------
export async function criarLista(_: Retorno | undefined, fd: FormData): Promise<Retorno> {
  const s = await sessao();
  if (!s) return { erro: "Sessão expirada. Entre de novo." };
  const nome = String(fd.get("nome") ?? "").trim().slice(0, 80);
  const descricao = String(fd.get("descricao") ?? "").trim().slice(0, 500) || null;
  if (!nome) return { erro: "Dê um nome para a lista." };
  const { error } = await s.supabase.from("contact_lists").insert({ nome, descricao });
  if (error) return { erro: mensagemDeErro(error.code, "Não foi possível criar a lista.") };
  revalidatePath("/clientes/listas");
  return { erro: null };
}

export async function excluirLista(fd: FormData) {
  const s = await sessao();
  const id = fd.get("id");
  if (!s || !ehUuid(id)) return;
  await s.supabase.from("contact_lists").delete().eq("id", id);
  revalidatePath("/clientes/listas");
}

export async function alternarLista(contactId: string, listId: string, ativo: boolean): Promise<Retorno> {
  const s = await sessao();
  if (!s || !ehUuid(contactId) || !ehUuid(listId)) return { erro: "Pedido inválido." };
  const { error } = ativo
    ? await s.supabase.from("contact_list_members").upsert({ list_id: listId, contact_id: contactId }, { onConflict: "list_id,contact_id", ignoreDuplicates: true })
    : await s.supabase.from("contact_list_members").delete().eq("list_id", listId).eq("contact_id", contactId);
  if (error) return { erro: mensagemDeErro(error.code, "Não foi possível atualizar a lista.") };
  revalidatePath(`/clientes/${contactId}`);
  revalidatePath("/clientes/listas");
  return { erro: null };
}

/** Coloca de uma vez, numa lista, os clientes que estão no filtro da tela (até 1.000). */
export async function adicionarFiltradosALista(_: (Retorno & { adicionados?: number }) | undefined, fd: FormData): Promise<Retorno & { adicionados?: number }> {
  const s = await sessao();
  if (!s) return { erro: "Sessão expirada. Entre de novo." };
  const listId = fd.get("list_id");
  if (!ehUuid(listId)) return { erro: "Escolha uma lista." };
  const ids = String(fd.get("ids") ?? "").split(",").filter(ehUuid).slice(0, 1000);
  if (ids.length === 0) return { erro: "Nenhum cliente neste filtro." };

  let adicionados = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await s.supabase
      .from("contact_list_members")
      .upsert(ids.slice(i, i + 200).map((contact_id) => ({ list_id: listId, contact_id })), { onConflict: "list_id,contact_id", ignoreDuplicates: true })
      .select("contact_id");
    if (error) return { erro: mensagemDeErro(error.code, "Não foi possível adicionar à lista."), adicionados };
    adicionados += data?.length ?? 0;
  }
  revalidatePath("/clientes/listas");
  return { erro: null, adicionados };
}

// ---------- atribuição de conversa ----------
export async function atribuirConversa(fd: FormData) {
  const s = await sessao();
  const conversationId = fd.get("conversation_id");
  const userId = String(fd.get("user_id") ?? "");
  if (!s || !ehUuid(conversationId)) return;
  if (userId !== "" && !ehUuid(userId)) return;
  // A chave composta do banco garante que o usuário é do mesmo negócio.
  await s.supabase.from("conversations").update({ assigned_user_id: userId === "" ? null : userId }).eq("id", conversationId);
  revalidatePath(`/conversas/${conversationId}`);
  revalidatePath("/conversas");
}

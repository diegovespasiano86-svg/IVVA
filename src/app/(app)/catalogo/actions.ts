"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { temRecurso } from "@/lib/planos";

export type EstadoCatalogo = { erro: string | null; ok?: boolean };

const TIPOS = ["servico", "venda", "insumo"] as const;
const MOTIVOS_MOVIMENTO = ["entrada", "ajuste", "perda", "uso"] as const;

async function contexto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role, tenants(plano)")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return null;
  const plano = (perfil.tenants as unknown as { plano: string } | null)?.plano;
  return { supabase, tenantId: perfil.tenant_id as string, ehDono: perfil.role === "dono", estoqueLiberado: temRecurso(plano, "estoque") };
}

const numero = (v: FormDataEntryValue | null, padrao = 0) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : padrao;
};

function mensagemEstoque(msg: string): string {
  const m = msg.match(/estoque_insuficiente:(.*):(\d+)/);
  if (m) return `Estoque insuficiente de "${m[1]}" (restam ${m[2]}).`;
  return "Não consegui salvar agora. Tente de novo.";
}

/** Cadastra um item do catálogo (serviço, produto de venda ou insumo). Estoque é opcional e depende do plano. */
export async function criarItem(_prev: EstadoCatalogo, formData: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return { erro: "Sessão expirada, faça login de novo." };
  if (!ctx.ehDono) return { erro: "Só o administrador cadastra itens no catálogo." };

  const tipo = String(formData.get("tipo") ?? "venda");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!(TIPOS as readonly string[]).includes(tipo)) return { erro: "Escolha o tipo do item." };
  if (!nome) return { erro: "Informe o nome do item." };
  const preco = numero(formData.get("preco"));
  const custo = numero(formData.get("custo"));
  if (preco < 0 || preco > 1_000_000 || custo < 0) return { erro: "Confira os valores informados." };

  const quer = formData.get("controla_estoque") === "on" && tipo !== "servico";
  const controla = quer && ctx.estoqueLiberado;
  const inicial = controla ? Math.max(0, Math.floor(numero(formData.get("estoque_atual")))) : 0;
  const minimo = controla ? Math.max(0, Math.floor(numero(formData.get("estoque_minimo")))) : 0;
  const duracao = tipo === "servico" ? Math.floor(numero(formData.get("duracao_minutos"))) || null : null;

  const { data: criado, error } = await ctx.supabase
    .from("products")
    .insert({
      tenant_id: ctx.tenantId,
      tipo,
      nome,
      categoria: String(formData.get("categoria") ?? "").trim() || null,
      preco,
      custo,
      controla_estoque: controla,
      estoque_atual: 0,
      estoque_minimo: minimo,
      duracao_minutos: duracao,
    })
    .select("id")
    .single();
  if (error || !criado) return { erro: "Não consegui cadastrar agora. Tente de novo." };

  if (controla && inicial > 0) {
    await ctx.supabase.rpc("estoque_movimentar", { p_product_id: criado.id, p_delta: inicial, p_tipo: "entrada", p_motivo: "Estoque inicial" });
  }

  revalidatePath("/catalogo");
  revalidatePath("/checkout");
  return { erro: null, ok: true };
}

/** Atualiza os dados de um item (não mexe no saldo: isso é movimentação). */
export async function editarItem(_prev: EstadoCatalogo, formData: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return { erro: "Sessão expirada, faça login de novo." };
  if (!ctx.ehDono) return { erro: "Só o administrador edita o catálogo." };
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return { erro: "Informe o nome do item." };
  const preco = numero(formData.get("preco"));
  const custo = numero(formData.get("custo"));
  if (preco < 0 || preco > 1_000_000 || custo < 0) return { erro: "Confira os valores informados." };

  const { data: atual } = await ctx.supabase.from("products").select("tipo, controla_estoque").eq("id", id).maybeSingle();
  if (!atual) return { erro: "Item não encontrado." };
  const querControle = formData.get("controla_estoque") === "on" && atual.tipo !== "servico" && ctx.estoqueLiberado;

  const { error } = await ctx.supabase
    .from("products")
    .update({
      nome,
      categoria: String(formData.get("categoria") ?? "").trim() || null,
      preco,
      custo,
      estoque_minimo: Math.max(0, Math.floor(numero(formData.get("estoque_minimo")))),
      controla_estoque: ctx.estoqueLiberado ? querControle : atual.controla_estoque,
      duracao_minutos: atual.tipo === "servico" ? Math.floor(numero(formData.get("duracao_minutos"))) || null : null,
    })
    .eq("id", id);
  if (error) return { erro: "Não consegui salvar agora. Tente de novo." };
  revalidatePath("/catalogo");
  revalidatePath("/checkout");
  return { erro: null, ok: true };
}

/** Tira o item das listas e do Checkout sem perder o histórico. */
export async function alternarAtivo(formData: FormData) {
  const ctx = await contexto();
  if (!ctx?.ehDono) return;
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "true";
  if (!id) return;
  await ctx.supabase.from("products").update({ ativo }).eq("id", id);
  revalidatePath("/catalogo");
  revalidatePath("/checkout");
}

/** Movimenta o saldo: entrada de compra, ajuste de contagem, perda ou uso interno. Sempre com histórico. */
export async function movimentarEstoque(_prev: EstadoCatalogo, formData: FormData): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return { erro: "Sessão expirada, faça login de novo." };
  if (!ctx.estoqueLiberado) return { erro: "O controle de estoque faz parte do plano Profissional." };
  const id = String(formData.get("id") ?? "");
  const tipo = String(formData.get("tipo") ?? "ajuste");
  const qtd = Math.floor(numero(formData.get("quantidade")));
  if (!id || !qtd || qtd === 0) return { erro: "Informe a quantidade." };
  if (!(MOTIVOS_MOVIMENTO as readonly string[]).includes(tipo)) return { erro: "Escolha o tipo do movimento." };
  // entrada soma; perda e uso subtraem; ajuste aceita o sinal digitado.
  const delta = tipo === "entrada" ? Math.abs(qtd) : tipo === "perda" || tipo === "uso" ? -Math.abs(qtd) : qtd;

  const { error } = await ctx.supabase.rpc("estoque_movimentar", {
    p_product_id: id,
    p_delta: delta,
    p_tipo: tipo,
    p_motivo: String(formData.get("motivo") ?? "").trim() || null,
  });
  if (error) return { erro: mensagemEstoque(error.message) };
  revalidatePath("/catalogo");
  return { erro: null, ok: true };
}

/** Atalho + / − da lista (ajuste de 1 unidade). */
export async function ajusteRapido(formData: FormData) {
  const ctx = await contexto();
  if (!ctx?.estoqueLiberado) return;
  const id = String(formData.get("id") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  if (!id || !delta) return;
  await ctx.supabase.rpc("estoque_movimentar", { p_product_id: id, p_delta: delta, p_tipo: "ajuste", p_motivo: "Ajuste rápido" });
  revalidatePath("/catalogo");
}

/** Salva a ficha técnica de um serviço: quais insumos ele consome e quanto, a cada atendimento. */
export async function salvarFicha(servicoId: string, linhas: { insumoId: string; quantidade: number }[]): Promise<EstadoCatalogo> {
  const ctx = await contexto();
  if (!ctx) return { erro: "Sessão expirada, faça login de novo." };
  if (!ctx.ehDono) return { erro: "Só o administrador edita a ficha técnica." };
  if (!ctx.estoqueLiberado) return { erro: "A ficha técnica faz parte do controle de estoque (plano Profissional)." };

  const limpas = new Map<string, number>();
  for (const l of linhas) {
    const q = Math.floor(Number(l.quantidade));
    if (!l.insumoId || !Number.isFinite(q) || q < 1 || q > 1000) return { erro: "Confira as quantidades da ficha (de 1 a 1000)." };
    limpas.set(l.insumoId, q);
  }

  const { data: servico } = await ctx.supabase.from("products").select("id, tipo").eq("id", servicoId).maybeSingle();
  if (!servico || servico.tipo !== "servico") return { erro: "Serviço não encontrado." };

  const { error: erroApagar } = await ctx.supabase.from("product_consumos").delete().eq("servico_id", servicoId);
  if (erroApagar) return { erro: "Não consegui salvar agora. Tente de novo." };
  if (limpas.size > 0) {
    const { error } = await ctx.supabase.from("product_consumos").insert(
      [...limpas].map(([insumo_id, quantidade]) => ({ tenant_id: ctx.tenantId, servico_id: servicoId, insumo_id, quantidade })),
    );
    if (error) return { erro: "Não consegui salvar agora. Tente de novo." };
  }
  revalidatePath("/catalogo");
  return { erro: null, ok: true };
}

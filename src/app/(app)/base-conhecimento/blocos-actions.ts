"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extrairEntradasConhecimento } from "@/lib/extracao-conhecimento";
import { getSegmento } from "@/lib/segmentos";
import { CATEGORIA_IDS, blocosDoSegmento, classificar, type CategoriaId } from "@/lib/blocos-conhecimento";

type Sb = Awaited<ReturnType<typeof createClient>>;

// O negócio SEMPRE vem da sessão de quem está logado, nunca do navegador.
async function tenantDaSessao(supabase: Sb): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  return perfil?.tenant_id ?? null;
}

function categoriaValida(v: FormDataEntryValue | null): CategoriaId | null {
  const s = String(v ?? "");
  return CATEGORIA_IDS.includes(s) ? (s as CategoriaId) : null;
}

/** Adiciona um item escrito à mão (já no tema escolhido; se vazio, a gente classifica). */
export async function criarBloco(formData: FormData) {
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!conteudo) return;
  const supabase = await createClient();
  const tenantId = await tenantDaSessao(supabase);
  if (!tenantId) return;
  await supabase.from("knowledge_base").insert({
    tenant_id: tenantId,
    tipo: "texto",
    conteudo,
    categoria: categoriaValida(formData.get("categoria")) ?? classificar(conteudo),
  });
  revalidatePath("/base-conhecimento");
}

/** Salva o que veio de arquivo, voz ou divisão de texto, já organizado em temas. */
export async function salvarEntradasClassificadas(formData: FormData) {
  const tipo = String(formData.get("tipo") ?? "texto");
  const arquivoId = String(formData.get("arquivo_id") ?? "").trim() || null;
  const substituirId = String(formData.get("substituir_id") ?? "").trim() || null;
  const entradas = formData
    .getAll("entrada")
    .map((e) => String(e).trim())
    .filter(Boolean);
  if (entradas.length === 0) return;

  const supabase = await createClient();
  const tenantId = await tenantDaSessao(supabase);
  if (!tenantId) return;

  const { error } = await supabase.from("knowledge_base").insert(
    entradas.map((conteudo) => ({ tenant_id: tenantId, tipo, conteudo, categoria: classificar(conteudo) })),
  );
  if (error) return;

  // Só apaga o texto original DEPOIS de ter salvo os blocos novos com sucesso.
  if (substituirId) await supabase.from("knowledge_base").delete().eq("id", substituirId);

  if (arquivoId) {
    await supabase.from("knowledge_files").update({ entradas_geradas: entradas.length }).eq("id", arquivoId);
  }
  revalidatePath("/base-conhecimento");
}

export type EstadoModelo = { adicionados: number; jaExistiam: number; erro: string | null } | undefined;

/** Preenche os blocos com o modelo do nicho, sem duplicar o que já existe. */
export async function aplicarModeloNicho(_prev: EstadoModelo, formData: FormData): Promise<EstadoModelo> {
  const segmentoId = String(formData.get("segmento_id") ?? "");
  if (!getSegmento(segmentoId)) return { adicionados: 0, jaExistiam: 0, erro: "Escolha um nicho." };

  const supabase = await createClient();
  const tenantId = await tenantDaSessao(supabase);
  if (!tenantId) return { adicionados: 0, jaExistiam: 0, erro: "Sessão expirada. Entre de novo." };

  const { data: existentes } = await supabase.from("knowledge_base").select("conteudo");
  const jaTem = new Set((existentes ?? []).map((e) => e.conteudo.trim().toLowerCase()));
  const novos = blocosDoSegmento(segmentoId).filter((b) => !jaTem.has(b.conteudo.trim().toLowerCase()));

  if (novos.length > 0) {
    const { error } = await supabase
      .from("knowledge_base")
      .insert(novos.map((b) => ({ tenant_id: tenantId, tipo: "texto", conteudo: b.conteudo, categoria: b.categoria })));
    if (error) return { adicionados: 0, jaExistiam: 0, erro: "Não foi possível adicionar o modelo agora. Tente de novo." };
  }

  // Guarda o nicho escolhido (se a regra de acesso não permitir, o modelo já foi aplicado mesmo assim).
  await supabase.from("tenants").update({ segmento: segmentoId }).eq("id", tenantId);

  revalidatePath("/base-conhecimento");
  return { adicionados: novos.length, jaExistiam: blocosDoSegmento(segmentoId).length - novos.length, erro: null };
}

/** Coloca no tema certo tudo o que ainda está sem tema (textos longos ficam de fora). */
export async function organizarAutomaticamente() {
  const supabase = await createClient();
  const tenantId = await tenantDaSessao(supabase);
  if (!tenantId) return;

  const { data } = await supabase.from("knowledge_base").select("id, conteudo").is("categoria", null);
  const porTema = new Map<CategoriaId, string[]>();
  for (const e of data ?? []) {
    if (e.conteudo.length > 1200) continue;
    const c = classificar(e.conteudo);
    porTema.set(c, [...(porTema.get(c) ?? []), e.id]);
  }
  for (const [categoria, ids] of porTema) {
    await supabase.from("knowledge_base").update({ categoria }).in("id", ids);
  }
  revalidatePath("/base-conhecimento");
}

export async function moverEntrada(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const categoria = categoriaValida(formData.get("categoria"));
  if (!id || !categoria) return;
  const supabase = await createClient();
  await supabase.from("knowledge_base").update({ categoria }).eq("id", id);
  revalidatePath("/base-conhecimento");
}

export type EstadoDivisao = { entradas: string[]; erro: string | null; aviso: string | null };

/** Lê um texto corrido e devolve itens curtos PARA REVISÃO. Não grava nem apaga nada. */
export async function dividirTextoLongo(entradaId: string): Promise<EstadoDivisao> {
  const supabase = await createClient();
  const tenantId = await tenantDaSessao(supabase);
  if (!tenantId) return { entradas: [], erro: "Sessão expirada. Entre de novo.", aviso: null };

  const { data: linha } = await supabase.from("knowledge_base").select("conteudo").eq("id", entradaId).maybeSingle();
  if (!linha?.conteudo) return { entradas: [], erro: "Texto não encontrado.", aviso: null };

  try {
    const { entradas, truncado } = await extrairEntradasConhecimento({ texto: linha.conteudo });
    if (entradas.length === 0) return { entradas: [], erro: "Não encontrei fatos claros nesse texto.", aviso: null };
    return {
      entradas,
      erro: null,
      aviso: truncado ? "O texto era muito longo e a IA parou no meio. Revise: alguns trechos podem ter ficado de fora." : null,
    };
  } catch (e) {
    return { entradas: [], erro: e instanceof Error ? e.message : "Falha ao dividir o texto.", aviso: null };
  }
}

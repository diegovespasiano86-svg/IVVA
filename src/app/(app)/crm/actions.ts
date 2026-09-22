"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function contexto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role, nome")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return null;

  return { supabase, userId: user.id, ...perfil };
}

export async function criarContato(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  if (!nome || !telefone) return;

  const ctx = await contexto();
  if (!ctx) return;

  const { data: primeiraEtapa } = await ctx.supabase
    .from("funnel_stages")
    .select("key")
    .eq("tenant_id", ctx.tenant_id)
    .order("posicao", { ascending: true })
    .limit(1)
    .maybeSingle();

  await ctx.supabase.from("contacts").insert({
    tenant_id: ctx.tenant_id,
    nome,
    telefone,
    status_funil: primeiraEtapa?.key ?? "sem_contato",
  });

  revalidatePath("/crm");
  revalidatePath("/calendario");
  revalidatePath("/dashboard");
}

export async function moverContato(contactId: string, novoEstagio: string) {
  const ctx = await contexto();
  if (!ctx) return;

  const { data: contato } = await ctx.supabase
    .from("contacts")
    .select("status_funil")
    .eq("id", contactId)
    .maybeSingle();
  if (!contato || contato.status_funil === novoEstagio) return;

  const { data: estagios } = await ctx.supabase
    .from("funnel_stages")
    .select("key, label")
    .eq("tenant_id", ctx.tenant_id);
  const labelDe =
    estagios?.find((e) => e.key === contato.status_funil)?.label ??
    contato.status_funil;
  const labelPara =
    estagios?.find((e) => e.key === novoEstagio)?.label ?? novoEstagio;

  await ctx.supabase
    .from("contacts")
    .update({ status_funil: novoEstagio })
    .eq("id", contactId);

  await ctx.supabase.from("contact_notes").insert({
    tenant_id: ctx.tenant_id,
    contact_id: contactId,
    autor_id: ctx.userId,
    tipo: "mudanca_estagio",
    conteudo: `${ctx.nome} moveu de "${labelDe}" para "${labelPara}"`,
  });

  revalidatePath("/crm");
}

export async function buscarHistorico(contactId: string) {
  const ctx = await contexto();
  if (!ctx) return [];

  const { data } = await ctx.supabase
    .from("contact_notes")
    .select("id, tipo, conteudo, created_at, users(nome)")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((n) => ({
    id: n.id as string,
    tipo: n.tipo as string,
    conteudo: n.conteudo as string,
    created_at: n.created_at as string,
    autor: (n.users as unknown as { nome: string } | null)?.nome ?? null,
  }));
}

export async function adicionarNota(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!contactId || !conteudo) return;

  const ctx = await contexto();
  if (!ctx) return;

  await ctx.supabase.from("contact_notes").insert({
    tenant_id: ctx.tenant_id,
    contact_id: contactId,
    autor_id: ctx.userId,
    tipo: "nota",
    conteudo,
  });

  revalidatePath("/crm");
}

const ESTADO_CIVIL_VALIDOS = [
  "solteiro",
  "casado",
  "uniao_estavel",
  "divorciado",
  "viuvo",
];

export async function atualizarContato(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  if (!contactId) return;

  const ctx = await contexto();
  if (!ctx) return;

  const nome = String(formData.get("nome") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const dataNascimento = String(formData.get("data_nascimento") ?? "").trim();
  const estadoCivil = String(formData.get("estado_civil") ?? "").trim();
  const comoConheceu = String(formData.get("como_conheceu") ?? "").trim();

  await ctx.supabase
    .from("contacts")
    .update({
      nome: nome || undefined,
      telefone: telefone || undefined,
      email: email || null,
      data_nascimento: dataNascimento || null,
      estado_civil: ESTADO_CIVIL_VALIDOS.includes(estadoCivil)
        ? estadoCivil
        : null,
      como_conheceu: comoConheceu || null,
    })
    .eq("id", contactId);

  revalidatePath("/crm");
}

function slugify(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function criarEstagio(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  const ctx = await contexto();
  if (!ctx || ctx.role !== "dono") return;

  const { data: existentes } = await ctx.supabase
    .from("funnel_stages")
    .select("key, posicao")
    .eq("tenant_id", ctx.tenant_id)
    .order("posicao", { ascending: false })
    .limit(1);

  let key = slugify(label) || `estagio_${Date.now()}`;
  const { data: colisao } = await ctx.supabase
    .from("funnel_stages")
    .select("key")
    .eq("tenant_id", ctx.tenant_id)
    .eq("key", key)
    .maybeSingle();
  if (colisao) key = `${key}_${Date.now()}`;

  const proximaPosicao = (existentes?.[0]?.posicao ?? -1) + 1;

  await ctx.supabase.from("funnel_stages").insert({
    tenant_id: ctx.tenant_id,
    key,
    label,
    posicao: proximaPosicao,
  });

  revalidatePath("/crm");
}

export async function renomearEstagio(formData: FormData) {
  const stageId = String(formData.get("stage_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!stageId || !label) return;

  const ctx = await contexto();
  if (!ctx || ctx.role !== "dono") return;

  await ctx.supabase
    .from("funnel_stages")
    .update({ label })
    .eq("id", stageId)
    .eq("tenant_id", ctx.tenant_id);

  revalidatePath("/crm");
}

export async function excluirEstagio(formData: FormData) {
  const stageId = String(formData.get("stage_id") ?? "");
  if (!stageId) return;

  const ctx = await contexto();
  if (!ctx || ctx.role !== "dono") return;

  const { data: todos } = await ctx.supabase
    .from("funnel_stages")
    .select("id, key, posicao")
    .eq("tenant_id", ctx.tenant_id)
    .order("posicao", { ascending: true });
  if (!todos || todos.length <= 1) return; // sempre sobra ao menos 1 fase

  const alvo = todos.find((e) => e.id === stageId);
  if (!alvo) return;

  const destino = todos.find((e) => e.id !== stageId);
  if (!destino) return;

  // reatribui os contatos dessa fase para a primeira fase restante
  await ctx.supabase
    .from("contacts")
    .update({ status_funil: destino.key })
    .eq("tenant_id", ctx.tenant_id)
    .eq("status_funil", alvo.key);

  await ctx.supabase
    .from("funnel_stages")
    .delete()
    .eq("id", stageId)
    .eq("tenant_id", ctx.tenant_id);

  revalidatePath("/crm");
}

// Histórico de WhatsApp (Coexistência): a IA só sugere quem parece
// cliente — confirmar de verdade é sempre uma decisão manual do dono/
// equipe, nunca automática. Aqui o contato "oficial" nasce de fato.
export async function confirmarContatoHistorico(formData: FormData) {
  const historicoId = String(formData.get("historico_id") ?? "");
  if (!historicoId) return;

  const ctx = await contexto();
  if (!ctx) return;

  const { data: item } = await ctx.supabase
    .from("whatsapp_historico_contatos")
    .select("telefone, nome_sugerido")
    .eq("id", historicoId)
    .eq("tenant_id", ctx.tenant_id)
    .maybeSingle();
  if (!item) return;

  const { data: primeiraEtapa } = await ctx.supabase
    .from("funnel_stages")
    .select("key")
    .eq("tenant_id", ctx.tenant_id)
    .order("posicao", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: contato } = await ctx.supabase
    .from("contacts")
    .insert({
      tenant_id: ctx.tenant_id,
      nome: item.nome_sugerido?.trim() || item.telefone,
      telefone: item.telefone,
      status_funil: primeiraEtapa?.key ?? "sem_contato",
      tipo_relacionamento: "cliente",
    })
    .select("id")
    .single();

  await ctx.supabase
    .from("whatsapp_historico_contatos")
    .update({ confirmado: true, contact_id: contato?.id ?? null })
    .eq("id", historicoId)
    .eq("tenant_id", ctx.tenant_id);

  revalidatePath("/crm");
}

// "Não é cliente" — só marca como revisado, sem criar contato. Some da
// lista de sugestões sem virar ninguém no funil.
export async function ignorarContatoHistorico(formData: FormData) {
  const historicoId = String(formData.get("historico_id") ?? "");
  if (!historicoId) return;

  const ctx = await contexto();
  if (!ctx) return;

  await ctx.supabase
    .from("whatsapp_historico_contatos")
    .update({ confirmado: true })
    .eq("id", historicoId)
    .eq("tenant_id", ctx.tenant_id);

  revalidatePath("/crm");
}

export async function moverEstagioOrdem(formData: FormData) {
  const stageId = String(formData.get("stage_id") ?? "");
  const direcao = String(formData.get("direcao") ?? ""); // "up" | "down"
  if (!stageId || !["up", "down"].includes(direcao)) return;

  const ctx = await contexto();
  if (!ctx || ctx.role !== "dono") return;

  const { data: todos } = await ctx.supabase
    .from("funnel_stages")
    .select("id, posicao")
    .eq("tenant_id", ctx.tenant_id)
    .order("posicao", { ascending: true });
  if (!todos) return;

  const idx = todos.findIndex((e) => e.id === stageId);
  const vizinhoIdx = direcao === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || vizinhoIdx < 0 || vizinhoIdx >= todos.length) return;

  const atual = todos[idx];
  const vizinho = todos[vizinhoIdx];

  await ctx.supabase
    .from("funnel_stages")
    .update({ posicao: vizinho.posicao })
    .eq("id", atual.id);
  await ctx.supabase
    .from("funnel_stages")
    .update({ posicao: atual.posicao })
    .eq("id", vizinho.id);

  revalidatePath("/crm");
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarDataNascimento, normalizarTelefone } from "@/lib/clientes";

type Sb = Awaited<ReturnType<typeof createClient>>;

async function contexto(): Promise<{ supabase: Sb; userId: string; tenantId: string; role: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("users").select("tenant_id, role").eq("id", user.id).maybeSingle();
  if (!perfil) return null;
  return { supabase, userId: user.id, tenantId: perfil.tenant_id, role: perfil.role };
}

export async function adicionarNotaCliente(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const conteudo = String(formData.get("conteudo") ?? "").trim().slice(0, 2000);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactId) || !conteudo) return;
  const ctx = await contexto();
  if (!ctx) return;
  // A leitura passa pela RLS: se o contato não é do seu negócio, não aparece.
  const { data: contato } = await ctx.supabase.from("contacts").select("id").eq("id", contactId).maybeSingle();
  if (!contato) return;
  await ctx.supabase.from("contact_notes").insert({
    tenant_id: ctx.tenantId,
    contact_id: contactId,
    autor_id: ctx.userId,
    tipo: "nota",
    conteudo,
  });
  revalidatePath(`/clientes/${contactId}`);
}

export type LinhaImportacao = { nome: string; telefone: string; email?: string; instagram?: string; aniversario?: string; comoConheceu?: string };
export type ResultadoImportacao = {
  ok: boolean;
  erro?: string;
  inseridos: number;
  jaExistiam: number;
  invalidos: number;
  duplicadosNoArquivo: number;
};

const MAX_LINHAS = 2000;
const limpar = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/**
 * Importa clientes. Tudo é REVALIDADO aqui (o navegador não é confiável):
 * telefone normalizado, duplicados descartados (inclusive contra os já cadastrados
 * em qualquer formato) e consentimento só marcado se o dono declarar.
 */
export async function importarContatos(linhas: LinhaImportacao[], autorizado: boolean): Promise<ResultadoImportacao> {
  const vazio = { inseridos: 0, jaExistiam: 0, invalidos: 0, duplicadosNoArquivo: 0 };
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Sessão expirada. Entre de novo.", ...vazio };
  if (ctx.role !== "dono") return { ok: false, erro: "Só o dono do negócio pode importar clientes.", ...vazio };
  if (!Array.isArray(linhas) || linhas.length === 0) return { ok: false, erro: "Nenhuma linha para importar.", ...vazio };
  if (linhas.length > MAX_LINHAS) return { ok: false, erro: `Importe até ${MAX_LINHAS} clientes por vez.`, ...vazio };

  const { data: existentes } = await ctx.supabase.from("contacts").select("telefone").limit(20000);
  const jaTem = new Set((existentes ?? []).map((c) => normalizarTelefone(c.telefone) ?? c.telefone));

  const { data: etapa } = await ctx.supabase
    .from("funnel_stages")
    .select("key")
    .eq("tenant_id", ctx.tenantId)
    .order("posicao", { ascending: true })
    .limit(1)
    .maybeSingle();

  let invalidos = 0;
  let jaExistiam = 0;
  let duplicadosNoArquivo = 0;
  const vistos = new Set<string>();
  const novos: Record<string, unknown>[] = [];

  for (const l of linhas) {
    const tel = normalizarTelefone(limpar(l?.telefone, 40));
    const nome = limpar(l?.nome, 120);
    if (!tel || !nome) {
      invalidos++;
      continue;
    }
    if (vistos.has(tel)) {
      duplicadosNoArquivo++;
      continue;
    }
    vistos.add(tel);
    if (jaTem.has(tel)) {
      jaExistiam++;
      continue;
    }
    const email = limpar(l?.email, 160);
    const instagram = limpar(l?.instagram, 80).replace(/^@/, "");
    novos.push({
      tenant_id: ctx.tenantId,
      nome,
      telefone: tel,
      email: /^\S+@\S+\.\S+$/.test(email) ? email : null,
      instagram: instagram || null,
      data_nascimento: normalizarDataNascimento(limpar(l?.aniversario, 20)),
      como_conheceu: limpar(l?.comoConheceu, 120) || null,
      status_funil: etapa?.key ?? "sem_contato",
      // Importado não tem consentimento comprovado: só liga se o dono declarar.
      aceita_mensagem_automatica: autorizado === true,
    });
  }

  let inseridos = 0;
  for (let i = 0; i < novos.length; i += 200) {
    const { data, error } = await ctx.supabase
      .from("contacts")
      .upsert(novos.slice(i, i + 200), { onConflict: "tenant_id,telefone", ignoreDuplicates: true })
      .select("id");
    if (error) return { ok: false, erro: "Houve um problema ao salvar parte dos clientes. Confira a lista e tente de novo.", inseridos, jaExistiam, invalidos, duplicadosNoArquivo };
    inseridos += data?.length ?? 0;
  }

  // Trilha de auditoria (LGPD): quem importou, quantos e se declarou autorização para enviar mensagens.
  await ctx.supabase.from("eventos").insert({
    tenant_id: ctx.tenantId,
    tipo: "importacao_clientes",
    detalhe: { user_id: ctx.userId, inseridos, ja_existiam: jaExistiam, invalidos, autorizado_envio: autorizado === true, em: new Date().toISOString() },
  });

  revalidatePath("/clientes");
  revalidatePath("/crm");
  revalidatePath("/dashboard");
  return { ok: true, inseridos, jaExistiam, invalidos, duplicadosNoArquivo };
}

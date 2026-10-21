"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { montarVenda, type Forma, type MotivoRecusa, type VendaBruta, type VendaPronta } from "@/lib/vendas-importacao";

export type ResultadoVendas = {
  ok: boolean;
  erro?: string;
  importacaoId?: string;
  inseridas: number;
  jaExistiam: number;
  clientesNovos: number;
  semCliente: number;
  recusadas: Partial<Record<MotivoRecusa, number>>;
};

const MAX_LINHAS = 2000;
const FORMAS: Forma[] = ["pix", "credito", "debito", "dinheiro"];
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const vazio = (): ResultadoVendas => ({ ok: false, inseridas: 0, jaExistiam: 0, clientesNovos: 0, semCliente: 0, recusadas: {} });

async function contexto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("users").select("tenant_id, role").eq("id", user.id).maybeSingle();
  if (!perfil) return null;
  return { supabase, userId: user.id, tenantId: perfil.tenant_id as string, role: perfil.role as string };
}

/**
 * Importa vendas de meses anteriores. Tudo é REVALIDADO aqui. Não mexe no estoque (o saldo atual já reflete
 * essas vendas), não gera comissão e só aceita datas anteriores ao mês atual, para não se misturar com o caixa de hoje.
 */
export async function importarVendas(linhas: VendaBruta[], formaPadrao: string | null): Promise<ResultadoVendas> {
  const r = vazio();
  const ctx = await contexto();
  if (!ctx) return { ...r, erro: "Sessão expirada. Entre de novo." };
  if (ctx.role !== "dono") return { ...r, erro: "Só o dono do negócio importa o histórico de vendas." };
  if (!Array.isArray(linhas) || linhas.length === 0) return { ...r, erro: "Nenhuma linha para importar." };
  if (linhas.length > MAX_LINHAS) return { ...r, erro: `Importe até ${MAX_LINHAS} vendas por vez.` };
  const padrao = FORMAS.find((f) => f === formaPadrao) ?? null;

  const prontas: VendaPronta[] = [];
  for (const l of linhas) {
    const m = montarVenda(l ?? {}, padrao);
    if ("motivo" in m) r.recusadas[m.motivo] = (r.recusadas[m.motivo] ?? 0) + 1;
    else prontas.push(m.venda);
  }
  if (prontas.length === 0) return { ...r, ok: true };

  // Clientes: casa pelo telefone; quem não existe e veio com nome é cadastrado (sem autorização de mensagens).
  const { data: contatos } = await ctx.supabase.from("contacts").select("id, telefone").limit(20000);
  const idPorTel = new Map<string, string>((contatos ?? []).map((c) => [c.telefone as string, c.id as string]));
  const novos = new Map<string, Record<string, unknown>>();
  for (const v of prontas) {
    if (idPorTel.has(v.telefone) || novos.has(v.telefone) || !v.nome) continue;
    novos.set(v.telefone, { tenant_id: ctx.tenantId, nome: v.nome, telefone: v.telefone, tipo_relacionamento: "cliente", aceita_mensagem_automatica: false });
  }
  if (novos.size > 0) {
    const lista = [...novos.values()];
    for (let i = 0; i < lista.length; i += 200) {
      const { data, error } = await ctx.supabase
        .from("contacts")
        .upsert(lista.slice(i, i + 200), { onConflict: "tenant_id,telefone", ignoreDuplicates: true })
        .select("id, telefone");
      if (error) return { ...r, erro: "Não consegui cadastrar os clientes novos. Nada foi importado; tente de novo." };
      for (const c of data ?? []) {
        idPorTel.set(c.telefone as string, c.id as string);
        r.clientesNovos++;
      }
    }
  }

  const { data: profs } = await ctx.supabase.from("professionals").select("id, nome");
  const profPorNome = new Map((profs ?? []).map((p) => [semAcento(p.nome as string), p.id as string]));

  // Reimportar o mesmo arquivo não duplica: compara cliente, dia, valor e forma, contando ocorrências.
  const quandos = prontas.map((v) => v.quando).sort();
  const { data: existentes } = await ctx.supabase
    .from("payments")
    .select("contact_id, created_at, valor_total, forma_pagamento")
    .eq("origem", "importado")
    .gte("created_at", quandos[0])
    .lte("created_at", quandos[quandos.length - 1])
    .limit(20000);
  const chave = (cid: string, iso: string, valor: number, forma: string) => `${cid}|${new Date(iso).getTime()}|${valor.toFixed(2)}|${forma}`;
  const jaNoBanco = new Map<string, number>();
  for (const p of existentes ?? []) {
    const k = chave(p.contact_id as string, p.created_at as string, Number(p.valor_total), p.forma_pagamento as string);
    jaNoBanco.set(k, (jaNoBanco.get(k) ?? 0) + 1);
  }

  const importacaoId = randomUUID();
  const vistasNoArquivo = new Map<string, number>();
  const registros: Record<string, unknown>[] = [];
  for (const v of prontas) {
    const cid = idPorTel.get(v.telefone);
    if (!cid) {
      r.semCliente++;
      continue;
    }
    const k = chave(cid, v.quando, v.valor, v.forma);
    const n = (vistasNoArquivo.get(k) ?? 0) + 1;
    vistasNoArquivo.set(k, n);
    if (n <= (jaNoBanco.get(k) ?? 0)) {
      r.jaExistiam++;
      continue;
    }
    const nome = v.descricao || "Venda importada";
    registros.push({
      tenant_id: ctx.tenantId,
      contact_id: cid,
      professional_id: v.profissional ? profPorNome.get(semAcento(v.profissional)) ?? null : null,
      itens: [{ tipo: "servico", nome, servico: nome, qtd: 1, preco_unit: v.valor, valor: v.valor }],
      desconto: 0,
      forma_pagamento: v.forma,
      valor_total: v.valor,
      comissao_calculada: 0,
      created_at: v.quando,
      origem: "importado",
      importacao_id: importacaoId,
    });
  }

  for (let i = 0; i < registros.length; i += 200) {
    const { error } = await ctx.supabase.from("payments").insert(registros.slice(i, i + 200));
    if (error) {
      console.error("[vendas-importar] insert falhou", error.message);
      // Desfaz o que já entrou deste lote: importação é tudo ou nada.
      await ctx.supabase.from("payments").delete().eq("importacao_id", importacaoId);
      return { ...r, inseridas: 0, erro: "Não consegui salvar as vendas. Nada foi importado; tente de novo." };
    }
  }
  r.inseridas = registros.length;

  // Trilha de auditoria: quem importou e quantas vendas.
  await ctx.supabase.rpc("evento_auditoria", {
    p_tipo: "importacao_vendas",
    p_detalhe: { user_id: ctx.userId, importacao_id: importacaoId, inseridas: r.inseridas, ja_existiam: r.jaExistiam, clientes_novos: r.clientesNovos, em: new Date().toISOString() },
  });

  for (const p of ["/relatorios", "/dashboard", "/clientes", "/checkout"]) revalidatePath(p);
  return { ...r, ok: true, importacaoId: registros.length > 0 ? importacaoId : undefined };
}

/** Desfaz uma importação inteira (só as vendas daquele lote; clientes cadastrados por ela ficam). */
export async function desfazerImportacaoVendas(importacaoId: string): Promise<{ ok: boolean; apagadas: number; erro?: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(importacaoId)) return { ok: false, apagadas: 0, erro: "Importação inválida." };
  const ctx = await contexto();
  if (!ctx) return { ok: false, apagadas: 0, erro: "Sessão expirada. Entre de novo." };
  if (ctx.role !== "dono") return { ok: false, apagadas: 0, erro: "Só o dono desfaz uma importação." };
  const { data, error } = await ctx.supabase.from("payments").delete().eq("importacao_id", importacaoId).eq("origem", "importado").select("id");
  if (error) return { ok: false, apagadas: 0, erro: "Não consegui desfazer agora. Tente de novo." };
  await ctx.supabase.rpc("evento_auditoria", {
    p_tipo: "importacao_vendas_desfeita",
    p_detalhe: { user_id: ctx.userId, importacao_id: importacaoId, apagadas: data?.length ?? 0, em: new Date().toISOString() },
  });
  for (const p of ["/relatorios", "/dashboard", "/clientes", "/checkout"]) revalidatePath(p);
  return { ok: true, apagadas: data?.length ?? 0 };
}

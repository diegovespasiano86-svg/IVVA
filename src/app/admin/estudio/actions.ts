"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enviarEmail } from "@/lib/email";
import { AGENDA_ESTUDIO, ETAPAS } from "@/lib/estudio-ops";

async function admin() {
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("estudio_eh_admin");
  if (!ok) throw new Error("Sem permissão.");
  return supabase;
}

function centavos(v: FormDataEntryValue | null) {
  const t = String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!t) return null;
  const n = Math.round(parseFloat(t) * 100);
  return Number.isFinite(n) ? n : null;
}

/** Salva etapa, notas, custo e valor da proposta de um pedido. */
export async function salvarPedido(formData: FormData) {
  const supabase = await admin();
  const id = String(formData.get("id") ?? "");
  const etapa = String(formData.get("etapa") ?? "");
  if (!id || !ETAPAS.some((e) => e.id === etapa)) return { ok: false, erro: "Pedido inválido." };
  const { error } = await supabase
    .from("estudio_pedidos")
    .update({
      etapa,
      notas: String(formData.get("notas") ?? "").slice(0, 2000) || null,
      custo_centavos: centavos(formData.get("custo")),
      valor_proposta_centavos: centavos(formData.get("valor")),
    })
    .eq("id", id);
  revalidatePath("/admin/estudio");
  return error ? { ok: false, erro: error.message } : { ok: true };
}

/** Move o pedido de etapa (atalho dos botões do cartão). */
export async function moverPedido(id: string, etapa: string) {
  const supabase = await admin();
  if (!ETAPAS.some((e) => e.id === etapa)) return { ok: false };
  await supabase.from("estudio_pedidos").update({ etapa }).eq("id", id);
  revalidatePath("/admin/estudio");
  return { ok: true };
}

/** Libera o relatório: marca como entregue e avisa o cliente por e-mail (o arquivo já foi anexado). */
export async function liberarPedido(id: string) {
  const supabase = await admin();
  const { data: p } = await supabase.from("estudio_pedidos").select("id, email, nome, negocio, tenant_id").eq("id", id).maybeSingle();
  if (!p) return { ok: false, erro: "Pedido não encontrado." };
  const { count } = await supabase.from("estudio_arquivos").select("id", { count: "exact", head: true }).eq("pedido_id", id).eq("pasta", "relatorio");
  if (!count) return { ok: false, erro: "Anexe o relatório (pasta Relatórios) antes de liberar." };
  await supabase.from("estudio_pedidos").update({ etapa: "entregue", entregue_em: new Date().toISOString() }).eq("id", id);

  let avisado = false;
  if (p.email) {
    const nome = p.nome?.split(" ")[0] || "Olá";
    const r = await enviarEmail({
      para: p.email,
      assunto: "Seu diagnóstico do IVVA Estúdio está pronto",
      texto: `${nome}, o seu diagnóstico ficou pronto. Abra em app.ivva.app.br/estudio/relatorios. Marque a conversa de 25 minutos com o time: ${AGENDA_ESTUDIO}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#221D2C"><p>${nome},</p><p>O seu <b>diagnóstico do IVVA Estúdio</b> ficou pronto${p.negocio ? ` para <b>${p.negocio.replace(/</g, "")}</b>` : ""}.</p><p><a href="https://app.ivva.app.br/estudio/relatorios" style="display:inline-block;background:#5B48D6;color:#fff;padding:12px 20px;border-radius:99px;text-decoration:none;font-weight:bold">Abrir meu relatório</a></p><p>Quer passar o relatório com a gente? <a href="${AGENDA_ESTUDIO}" style="color:#5B48D6;font-weight:bold">Escolha o horário da conversa de 25 minutos</a> (Google Meet).</p><p style="color:#665F72;font-size:13px">Time do IVVA Estúdio · um produto do Decifrando IA</p></div>`,
    });
    avisado = r.ok;
  }
  revalidatePath("/admin/estudio");
  return { ok: true, avisado };
}

/** Registra um arquivo que o painel já subiu para o Storage. */
export async function registrarArquivo(dados: { pedidoId: string; tenantId: string; pasta: string; nome: string; path: string; tamanho: number }) {
  const supabase = await admin();
  const { error } = await supabase.from("estudio_arquivos").insert({
    pedido_id: dados.pedidoId,
    tenant_id: dados.tenantId,
    pasta: dados.pasta,
    nome: dados.nome.slice(0, 120),
    path: dados.path,
    tamanho: dados.tamanho,
    enviado_por: "equipe",
  });
  revalidatePath("/admin/estudio");
  return error ? { ok: false, erro: error.message } : { ok: true };
}

export async function apagarArquivo(id: string) {
  const supabase = await admin();
  const { data: a } = await supabase.from("estudio_arquivos").select("path").eq("id", id).maybeSingle();
  if (a?.path) await supabase.storage.from("estudio").remove([a.path]);
  await supabase.from("estudio_arquivos").delete().eq("id", id);
  revalidatePath("/admin/estudio");
  return { ok: true };
}

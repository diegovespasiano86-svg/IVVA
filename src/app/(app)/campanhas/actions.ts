"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODELOS, IDIOMAS, SEGMENTOS_CAMPANHA, modeloPorId, normalizarNomeModelo } from "@/lib/campanhas";
import { processarLotes } from "@/lib/campanhas-envio";

// Toda ação aqui exige DONO. A regra é aplicada em duas camadas: aqui (mensagem amigável)
// e no banco (RLS + funções), que recusa qualquer outra coisa mesmo se esta camada falhar.

type Sb = Awaited<ReturnType<typeof createClient>>;

async function donoDaSessao(): Promise<{ supabase: Sb } | { erro: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (perfil?.role !== "dono") return { erro: "Só o dono do negócio pode gerenciar campanhas." };
  return { supabase };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

function traduzir(msg: string | undefined): string {
  if (!msg) return "Não foi possível concluir. Tente de novo.";
  if (msg === "not allowed") return "Só o dono do negócio pode fazer isso.";
  return msg; // as funções do banco já devolvem mensagens em português
}

export type Retorno<T = object> = ({ erro: string } | ({ erro: null } & T));

export async function criarCampanha(formData: FormData) {
  const ctx = await donoDaSessao();
  if ("erro" in ctx) redirect("/campanhas?erro=" + encodeURIComponent(ctx.erro));

  const modelo = modeloPorId(String(formData.get("modelo") ?? ""));
  const nome = (modelo ? modelo.titulo : "Nova campanha").slice(0, 120);
  const { data, error } = await ctx.supabase
    .from("campaigns")
    .insert({
      nome,
      template_nome: modelo?.nomeModelo ?? null,
      usa_nome: modelo ? true : false,
      mensagem_previa: modelo?.corpo ?? null,
      audiencia: modelo?.segmento ? { tipo: "segmento", segmento: modelo.segmento } : { tipo: "todos" },
    })
    .select("id")
    .single();
  if (error || !data) redirect("/campanhas?erro=" + encodeURIComponent("Não foi possível criar a campanha."));
  revalidatePath("/campanhas");
  redirect(`/campanhas/${data.id}`);
}

export type DadosRascunho = {
  id: string;
  nome: string;
  templateNome: string;
  idioma: string;
  usaNome: boolean;
  previa: string;
  audTipo: "todos" | "lista" | "etiqueta" | "segmento";
  audIds: string[];
  segmento: string;
  agendadaPara: string | null; // ISO
};

export async function salvarRascunho(d: DadosRascunho): Promise<Retorno> {
  const ctx = await donoDaSessao();
  if ("erro" in ctx) return ctx;
  if (!ehUuid(d.id)) return { erro: "Campanha inválida." };

  const nome = String(d.nome ?? "").trim().slice(0, 120);
  if (!nome) return { erro: "Dê um nome para a campanha." };

  const templateNome = normalizarNomeModelo(String(d.templateNome ?? ""));
  const idioma = IDIOMAS.some((i) => i.id === d.idioma) ? d.idioma : "pt_BR";
  const previa = String(d.previa ?? "").slice(0, 1024);

  let audiencia: Record<string, unknown>;
  if (d.audTipo === "todos") audiencia = { tipo: "todos" };
  else if (d.audTipo === "segmento") {
    if (!SEGMENTOS_CAMPANHA.some((s) => s.id === d.segmento)) return { erro: "Escolha o segmento." };
    audiencia = { tipo: "segmento", segmento: d.segmento };
  } else if (d.audTipo === "lista" || d.audTipo === "etiqueta") {
    const ids = (d.audIds ?? []).filter(ehUuid).slice(0, 50);
    if (ids.length === 0) return { erro: d.audTipo === "lista" ? "Escolha pelo menos uma lista." : "Escolha pelo menos uma etiqueta." };
    audiencia = { tipo: d.audTipo, ids };
  } else return { erro: "Escolha o público." };

  let agendada: string | null = null;
  if (d.agendadaPara) {
    const t = new Date(d.agendadaPara).getTime();
    if (!Number.isFinite(t)) return { erro: "Data de agendamento inválida." };
    if (t <= Date.now()) return { erro: "O agendamento precisa ser no futuro." };
    if (t > Date.now() + 60 * 86400000) return { erro: "Agende para até 60 dias à frente." };
    agendada = new Date(t).toISOString();
  }

  const { error } = await ctx.supabase
    .from("campaigns")
    .update({
      nome,
      template_nome: templateNome || null,
      template_idioma: idioma,
      usa_nome: !!d.usaNome,
      mensagem_previa: previa || null,
      audiencia,
      agendada_para: agendada,
    })
    .eq("id", d.id);
  if (error) return { erro: traduzir(error.message) };
  revalidatePath(`/campanhas/${d.id}`);
  return { erro: null };
}

export async function prepararCampanha(id: string): Promise<Retorno<{ resultado: Record<string, number | string> }>> {
  const ctx = await donoDaSessao();
  if ("erro" in ctx) return ctx;
  if (!ehUuid(id)) return { erro: "Campanha inválida." };
  const { data, error } = await ctx.supabase.rpc("campanha_preparar", { p_campaign_id: id });
  if (error) return { erro: traduzir(error.message) };
  revalidatePath(`/campanhas/${id}`);
  return { erro: null, resultado: data as Record<string, number | string> };
}

export async function definirConsentimento(id: string, confirmado: boolean): Promise<Retorno> {
  const ctx = await donoDaSessao();
  if ("erro" in ctx) return ctx;
  if (!ehUuid(id)) return { erro: "Campanha inválida." };
  // O banco troca a data enviada por agora() e grava quem confirmou: não dá para forjar.
  const { error } = await ctx.supabase.from("campaigns").update({ consentimento_confirmado_em: confirmado ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { erro: traduzir(error.message) };
  revalidatePath(`/campanhas/${id}`);
  return { erro: null };
}

async function chamarFuncao(nome: "campanha_iniciar" | "campanha_pausar" | "campanha_cancelar", id: string): Promise<Retorno<{ resultado: Record<string, unknown> }>> {
  const ctx = await donoDaSessao();
  if ("erro" in ctx) return ctx;
  if (!ehUuid(id)) return { erro: "Campanha inválida." };
  const { data, error } = await ctx.supabase.rpc(nome, { p_campaign_id: id });
  if (error) return { erro: traduzir(error.message) };
  revalidatePath(`/campanhas/${id}`);
  revalidatePath("/campanhas");
  return { erro: null, resultado: data as Record<string, unknown> };
}

export const iniciarCampanha = async (id: string) => chamarFuncao("campanha_iniciar", id);
export const pausarCampanha = async (id: string) => chamarFuncao("campanha_pausar", id);
export const cancelarCampanha = async (id: string) => chamarFuncao("campanha_cancelar", id);

/**
 * Envia o próximo trecho da fila agora. O banco decide quem pode receber
 * (aceite, pausa de qualidade, teto de 250/dia). Devolve só contagens.
 */
export async function processarAgora(): Promise<Retorno<{ enviados: number; falhas: number; lotes: number }>> {
  const ctx = await donoDaSessao();
  if ("erro" in ctx) return ctx;
  const r = await processarLotes({ maxMs: 40000, limite: 25 });
  revalidatePath("/campanhas");
  return { erro: null, ...r };
}

// reexporta a lista só para tipagem em tempo de compilação (não é exportada em tempo de execução)
export type ModeloId = (typeof MODELOS)[number]["id"];

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { criarConviteProfissional } from "@/lib/convites";
import { contatoNoEscopo, type Escopo } from "@/lib/escopo-profissional";

export async function criarAgendamento(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const professionalId = String(formData.get("professional_id") ?? "");
  const dataHora = String(formData.get("data_hora") ?? "");
  const servico = String(formData.get("servico") ?? "").trim();
  const duracaoMinutos = Number(formData.get("duracao_minutos") ?? 30) || 30;

  if (!contactId || !professionalId || !dataHora) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role, nome, professional_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return;

  // Profissional agenda só para si e só para contatos da própria base.
  if (perfil.role === "profissional") {
    if (!perfil.professional_id || professionalId !== perfil.professional_id) return;
    const escopo: Escopo = {
      role: "profissional",
      tenantId: perfil.tenant_id,
      userId: user.id,
      nome: perfil.nome,
      professionalId: perfil.professional_id,
    };
    if (!(await contatoNoEscopo(supabase, escopo, contactId))) return;
  }

  await supabase.from("appointments").insert({
    tenant_id: perfil.tenant_id,
    contact_id: contactId,
    professional_id: professionalId,
    data_hora: new Date(dataHora).toISOString(),
    servico: servico || null,
    duracao_minutos: duracaoMinutos,
    origem: "manual",
    status: "agendado",
  });

  revalidatePath("/calendario");
  revalidatePath("/dashboard");
}

// ---- Profissionais da equipe -------------------------------------------------
// O dono cadastra quem atende (nome, cor, comissão) sem precisar de e-mail. Depois pode convidar a
// pessoa por e-mail: ela cria a própria senha e entra como "profissional" (agenda e atendimentos),
// nunca como administrador.

export type ProfissionalState = { erro: string | null; ok: boolean };
export type ConviteProfissionalState = {
  erro: string | null;
  enviado: boolean;
  link: string | null;
  email: string | null;
  motivoSemEmail: string | null;
};

async function donoAtual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, perfil: null };
  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role, nome")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, perfil: perfil?.role === "dono" ? perfil : null };
}

export async function adicionarProfissional(
  _prev: ProfissionalState,
  formData: FormData,
): Promise<ProfissionalState> {
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 80);
  const corBruta = String(formData.get("cor") ?? "");
  const cor = /^#[0-9a-fA-F]{6}$/.test(corBruta) ? corBruta : "#8B7FE8";
  const comissaoNum = Number(String(formData.get("comissao_pct") ?? "0").replace(",", "."));
  const comissao = Number.isFinite(comissaoNum) ? Math.min(Math.max(comissaoNum, 0), 100) : 0;
  const souEu = formData.get("sou_eu") === "on";

  if (!nome) return { erro: "Digite o nome do profissional.", ok: false };

  const { supabase, user, perfil } = await donoAtual();
  if (!user) return { erro: "Sessão expirada, faça login de novo.", ok: false };
  if (!perfil) return { erro: "Só o dono do negócio pode cadastrar profissionais.", ok: false };

  const { data: criado, error } = await supabase
    .from("professionals")
    .insert({ tenant_id: perfil.tenant_id, nome, cor, comissao_pct: comissao })
    .select("id")
    .single();
  if (error || !criado) return { erro: "Não consegui cadastrar agora. Tente de novo.", ok: false };

  // "Sou eu quem atende": liga o cadastro ao próprio dono (ele continua dono, com todo o acesso).
  if (souEu) {
    await supabase.from("users").update({ professional_id: criado.id }).eq("id", user.id);
  }

  revalidatePath("/calendario");
  revalidatePath("/dashboard");
  return { erro: null, ok: true };
}

export async function convidarProfissional(
  _prev: ConviteProfissionalState,
  formData: FormData,
): Promise<ConviteProfissionalState> {
  const vazio = { enviado: false, link: null, email: null, motivoSemEmail: null };
  const professionalId = String(formData.get("professional_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!professionalId || !email) return { ...vazio, erro: "Digite o e-mail do profissional." };

  const { supabase, user, perfil } = await donoAtual();
  if (!user) return { ...vazio, erro: "Sessão expirada, faça login de novo." };
  if (!perfil) return { ...vazio, erro: "Só o dono do negócio pode convidar profissionais." };

  const { data: prof } = await supabase
    .from("professionals")
    .select("id, nome")
    .eq("id", professionalId)
    .eq("tenant_id", perfil.tenant_id)
    .maybeSingle();
  if (!prof) return { ...vazio, erro: "Profissional não encontrado." };

  const { data: jaTemAcesso } = await supabase
    .from("users")
    .select("id")
    .eq("professional_id", prof.id)
    .limit(1);
  if ((jaTemAcesso ?? []).length > 0) {
    return { ...vazio, erro: "Esse profissional já tem acesso ao sistema." };
  }

  const headerList = await headers();
  const origin = headerList.get("origin") ?? `https://${headerList.get("host") ?? "localhost:3000"}`;

  const r = await criarConviteProfissional({
    supabase,
    tenantId: perfil.tenant_id,
    donoUserId: user.id,
    nome: prof.nome,
    email,
    professionalId: prof.id,
    origin,
  });
  if (r.erro) return { ...vazio, erro: r.erro };

  revalidatePath("/calendario");
  return { erro: null, enviado: r.emailEnviado, link: r.link, email, motivoSemEmail: r.emailMotivo };
}

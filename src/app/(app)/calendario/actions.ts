"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

// ---- Equipe ---------------------------------------------------------------
// Quem entra na equipe entra por convite de e-mail (ver criarConvite em conta/actions.ts), com o tipo
// de acesso escolhido pelo administrador. Aqui fica só o atalho do próprio administrador que também
// atende clientes: coloca ele na agenda sem precisar de convite.

import { bloqueioNovoProfissional } from "@/lib/limite-profissionais";
import { avisarProximoListaEspera } from "@/lib/lista-espera";

export type EuAtendoState = { erro: string | null };

export async function euTambemAtendo(_prev: EuAtendoState): Promise<EuAtendoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada, faça login de novo." };

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role, nome, professional_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || perfil.role !== "dono") return { erro: "Só o administrador pode fazer isso." };
  if (perfil.professional_id) return { erro: null };

  const bloqueio = await bloqueioNovoProfissional(supabase, perfil.tenant_id);
  if (bloqueio) return { erro: bloqueio };

  const { data: criado, error } = await supabase
    .from("professionals")
    .insert({ tenant_id: perfil.tenant_id, nome: perfil.nome, comissao_pct: 0 })
    .select("id")
    .single();
  if (error || !criado) return { erro: "Não consegui cadastrar agora. Tente de novo." };

  await supabase.from("users").update({ professional_id: criado.id }).eq("id", user.id);

  revalidatePath("/calendario");
  revalidatePath("/dashboard");
  return { erro: null };
}

export type AcaoAgendamento = "concluir" | "cancelar" | "remarcar";

/** Concluir, cancelar ou remarcar um agendamento direto pelo calendário. Cancelar avisa o próximo da lista de espera. */
export async function atualizarAgendamento(
  id: string,
  acao: AcaoAgendamento,
  novaDataHora?: string,
): Promise<{ erro: string | null; aviso?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada, faça login de novo." };

  const { data: ag } = await supabase
    .from("appointments")
    .select("id, tenant_id, professional_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!ag) return { erro: "Não encontramos esse agendamento." };
  if (ag.status === "cancelado") return { erro: "Esse horário já foi cancelado." };

  if (acao === "concluir") {
    const { error } = await supabase.from("appointments").update({ status: "concluido" }).eq("id", id);
    if (error) return { erro: "Não consegui concluir agora. Tente de novo." };
  } else if (acao === "remarcar") {
    const quando = novaDataHora ? new Date(novaDataHora) : null;
    if (!quando || Number.isNaN(quando.getTime())) return { erro: "Escolha a nova data e hora." };
    if (quando.getTime() < Date.now() - 60 * 1000) return { erro: "Escolha uma data e hora que ainda não passou." };
    const { error } = await supabase
      .from("appointments")
      .update({ data_hora: quando.toISOString(), status: "agendado", confirmado_em: null, lembrete_enviado_em: null })
      .eq("id", id);
    if (error) return { erro: "Não consegui remarcar agora. Tente de novo." };
  } else {
    const { error } = await supabase.from("appointments").update({ status: "cancelado" }).eq("id", id);
    if (error) return { erro: "Não consegui cancelar agora. Tente de novo." };
    let aviso: string | undefined;
    if (ag.professional_id) {
      const { data: cfg } = await supabase.from("bot_settings").select("lista_espera_ativo").maybeSingle();
      if (cfg?.lista_espera_ativo && (await avisarProximoListaEspera(ag.tenant_id, ag.professional_id))) {
        aviso = "Horário cancelado. Já avisamos a próxima pessoa da lista de espera.";
      }
    }
    revalidatePath("/calendario");
    revalidatePath("/dashboard");
    return { erro: null, aviso };
  }

  revalidatePath("/calendario");
  revalidatePath("/dashboard");
  return { erro: null };
}

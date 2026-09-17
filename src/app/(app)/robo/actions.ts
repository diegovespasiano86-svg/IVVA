"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hashPin } from "@/lib/pin";

export async function atualizarIdentidadeAssistente(
  _prevState: string | undefined,
  formData: FormData,
) {
  const nomeAssistente = String(formData.get("nome_assistente") ?? "").trim();
  const tom = String(formData.get("tom") ?? "").trim();
  const horarioAtendimento = String(formData.get("horario_atendimento") ?? "").trim();
  const vozInformada = String(formData.get("voz") ?? "").trim();
  const voz = vozInformada === "masculina" ? "masculina" : "feminina";
  const regrasTexto = String(formData.get("regras") ?? "");
  const regras = regrasTexto
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sessão expirada, faça login de novo.";

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || perfil.role !== "dono") {
    return "Só o dono do negócio pode configurar o atendimento.";
  }

  const { error } = await supabase
    .from("tenants")
    .update({
      identidade_assistente: {
        nome_assistente: nomeAssistente || undefined,
        tom: tom || undefined,
        horario_atendimento: horarioAtendimento || undefined,
        voz,
        regras,
      },
    })
    .eq("id", perfil.tenant_id);

  if (error) {
    return "Não consegui salvar. Tenta de novo.";
  }

  revalidatePath("/robo");
  return undefined;
}

export async function atualizarBotSettings(
  _prevState: string | undefined,
  formData: FormData,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sessão expirada, faça login de novo.";

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || perfil.role !== "dono") {
    return "Só o dono do negócio pode configurar isso.";
  }

  const posVendaDelay = String(formData.get("pos_venda_delay") ?? "1d");
  const novoPin = String(formData.get("admin_pin") ?? "").trim();

  if (novoPin && !/^\d{4,6}$/.test(novoPin)) {
    return "O PIN precisa ter de 4 a 6 dígitos numéricos.";
  }

  const dados: Record<string, unknown> = {
    tenant_id: perfil.tenant_id,
    pos_venda_ativo: formData.get("pos_venda_ativo") === "on",
    pos_venda_delay: posVendaDelay,
    pos_venda_mensagem: String(formData.get("pos_venda_mensagem") ?? "").trim() || null,
    pedir_instagram_primeiro_contato: formData.get("pedir_instagram_primeiro_contato") === "on",
    pedir_email_primeiro_contato: formData.get("pedir_email_primeiro_contato") === "on",
    reengajamento_ativo: formData.get("reengajamento_ativo") === "on",
    reengajamento_dias_inatividade: Number(formData.get("reengajamento_dias_inatividade") ?? 60) || 60,
    link_avaliacao_google: String(formData.get("link_avaliacao_google") ?? "").trim() || null,
    aniversario_ativo: formData.get("aniversario_ativo") === "on",
    aniversario_dias_antecedencia: Number(formData.get("aniversario_dias_antecedencia") ?? 0) || 0,
    aniversario_mensagem: String(formData.get("aniversario_mensagem") ?? "").trim() || null,
    admin_whatsapp_numero: String(formData.get("admin_whatsapp_numero") ?? "").trim() || null,
    upsell_template_nome: String(formData.get("upsell_template_nome") ?? "").trim() || null,
    lista_espera_ativo: formData.get("lista_espera_ativo") === "on",
    recuperar_conversa_ativo: formData.get("recuperar_conversa_ativo") === "on",
    recuperar_conversa_primeiro_toque_min:
      Number(formData.get("recuperar_conversa_primeiro_toque_min") ?? 45) || 45,
    indicacao_recompensa_ativo: formData.get("indicacao_recompensa_ativo") === "on",
    indicacao_recompensa_texto:
      String(formData.get("indicacao_recompensa_texto") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  // PIN só é trocado se o dono digitou um novo — campo fica sempre vazio
  // na tela (nunca mostramos o PIN salvo de volta).
  if (novoPin) {
    dados.admin_pin_hash = hashPin(novoPin);
  }

  const { error } = await supabase
    .from("bot_settings")
    .upsert(dados, { onConflict: "tenant_id" });

  if (error) {
    return "Não consegui salvar. Tenta de novo.";
  }

  revalidatePath("/robo");
  return undefined;
}

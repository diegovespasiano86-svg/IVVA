"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registrarPagamento(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const professionalId = String(formData.get("professional_id") ?? "");
  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  const servico = String(formData.get("servico") ?? "").trim();
  const valorTotal = Number(formData.get("valor_total") ?? 0);
  const formaPagamento = String(formData.get("forma_pagamento") ?? "");

  if (
    !contactId ||
    !professionalId ||
    !servico ||
    !valorTotal ||
    !formaPagamento
  ) {
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return;

  const { data: profissional } = await supabase
    .from("professionals")
    .select("comissao_pct")
    .eq("id", professionalId)
    .maybeSingle();

  const comissaoPct = Number(profissional?.comissao_pct ?? 0);
  const comissaoCalculada = Math.round(valorTotal * (comissaoPct / 100) * 100) / 100;

  await supabase.from("payments").insert({
    tenant_id: perfil.tenant_id,
    contact_id: contactId,
    professional_id: professionalId,
    appointment_id: appointmentId || null,
    itens: [{ servico, valor: valorTotal }],
    forma_pagamento: formaPagamento,
    valor_total: valorTotal,
    comissao_calculada: comissaoCalculada,
  });

  // Dá baixa no agendamento de origem, se veio de um — assim ele some da
  // lista de "aguardando checkout" e não fica pendindo pra sempre.
  if (appointmentId) {
    await supabase
      .from("appointments")
      .update({ status: "concluido" })
      .eq("id", appointmentId);
  }

  revalidatePath("/checkout");
  revalidatePath("/dashboard");
  revalidatePath("/calendario");
  revalidatePath("/faturamento");
}

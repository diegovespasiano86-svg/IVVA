import type { SupabaseClient } from "@supabase/supabase-js";

// Ponto único antes de qualquer envio PROATIVO (o negócio inicia a
// mensagem — pós-venda, lembrete, upsell em massa, aviso de vaga na lista
// de espera, recuperação de conversa esfriada...). NUNCA chamar isso antes
// de responder uma mensagem que o cliente mandou primeiro — a Meta só pausa
// aqui o que o negócio inicia por conta própria, e o atendimento reativo
// precisa continuar normal mesmo com o número em alerta de qualidade.
//
// Aceita tenant_id OU phone_number_id — usa o que já tiver disponível no
// call site, sem obrigar todo mundo a resolver o outro. Ponto único pra
// reaproveitar quando entrar horário de silêncio / limite semanal por
// contato, em vez de duplicar a checagem em cada lugar que manda mensagem.
export async function podeEnviarAutomatico(
  supabase: SupabaseClient,
  secret: string,
  params: { tenantId?: string; phoneNumberId?: string; telefone?: string },
): Promise<boolean> {
  const { data, error } = await supabase.rpc("whatsapp_pode_enviar_automatico", {
    p_secret: secret,
    p_tenant_id: params.tenantId ?? null,
    p_phone_number_id: params.phoneNumberId ?? null,
    p_telefone: params.telefone ?? null,
  });

  if (error) {
    console.error("[automacao] falha ao checar podeEnviarAutomatico — liberando por padrão", error);
    return true;
  }

  return data !== false;
}

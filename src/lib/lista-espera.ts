import { createClient } from "@supabase/supabase-js";
import { podeEnviarAutomatico } from "@/lib/automacao";
import { sendWhatsAppText } from "@/lib/whatsapp";

/**
 * Abriu uma vaga (cancelamento): avisa o próximo da lista de espera daquele profissional pelo WhatsApp.
 * Nunca lança erro: falha aqui não pode atrapalhar quem cancelou.
 */
export async function avisarProximoListaEspera(tenantId: string, professionalId: string): Promise<boolean> {
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret || !url || !anon) return false;

  try {
    const supabase = createClient(url, anon);
    if (!(await podeEnviarAutomatico(supabase, secret, { tenantId }))) return false;
    const { data } = await supabase.rpc("ia_notificar_proximo_lista_espera", {
      p_secret: secret,
      p_tenant_id: tenantId,
      p_professional_id: professionalId,
    });
    const item = data as {
      ok?: boolean;
      contact_nome?: string;
      contact_telefone?: string;
      preferencia_horario?: string;
      professional_nome?: string;
      phone_number_id?: string;
      access_token?: string;
    } | null;
    if (!item?.ok || !item.contact_telefone || !item.phone_number_id || !item.access_token) return false;

    const primeiroNome = item.contact_nome?.trim().split(/\s+/)[0] ?? "";
    const texto = `Oi${primeiroNome ? " " + primeiroNome : ""}! Abriu uma vaga com ${item.professional_nome ?? "a gente"}${
      item.preferencia_horario ? ` (${item.preferencia_horario})` : ""
    } — quer confirmar? Responde aqui que eu já deixo marcado.`;
    await sendWhatsAppText({ phoneNumberId: item.phone_number_id, token: item.access_token }, item.contact_telefone, texto);
    return true;
  } catch (err) {
    console.error("[lista-espera] falha ao avisar o próximo da fila", err);
    return false;
  }
}

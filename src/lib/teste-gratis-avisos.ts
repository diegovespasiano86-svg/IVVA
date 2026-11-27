import type { SupabaseClient } from "@supabase/supabase-js";
import { emailTesteSemCartao, enviarEmail, type AvisoTeste } from "./email";

/** Roda 1x por dia: o banco diz quem recebe o quê; cada etapa sai uma única vez. */
export async function enviarAvisosDoTeste(supabase: SupabaseClient, secret: string): Promise<number> {
  const { data, error } = await supabase.rpc("teste_gratis_avisos", { p_secret: secret });
  if (error) throw new Error(error.message);
  let enviados = 0;
  for (const a of (data ?? []) as AvisoTeste[]) {
    const envio = await enviarEmail({ para: a.email, ...emailTesteSemCartao(a) });
    if (!envio.ok) continue;
    await supabase.rpc("teste_gratis_aviso_marcar", { p_secret: secret, p_tenant_id: a.tenant_id, p_etapa: a.etapa });
    enviados++;
  }
  return enviados;
}

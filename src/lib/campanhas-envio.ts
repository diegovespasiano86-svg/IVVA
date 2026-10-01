import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

type Item = {
  recipient_id: string;
  campaign_id: string;
  tenant_id: string;
  primeiro_nome: string | null;
  telefone: string;
  template_nome: string;
  template_idioma: string;
  usa_nome: boolean;
  phone_number_id: string;
  access_token: string;
};

export type ResultadoEnvio = { enviados: number; falhas: number; lotes: number };

// Erros que indicam problema da CONTA/TOKEN (e não de um destinatário específico).
const ERRO_DE_CONTA = /access token|oauth|session has (been )?(expired|invalidated)|token.*(expired|invalid)|permission/i;

const limparVariavel = (v: string | null) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || "cliente";

/**
 * Processa campanhas pendentes em lotes pequenos. A seleção, o teto diário, o opt-out
 * e a pausa de qualidade são decididos NO BANCO (campanha_proximo_lote). Aqui só se envia
 * e se registra o resultado de cada mensagem. Nada com token sai deste arquivo.
 */
export async function processarLotes(opts: { maxMs?: number; limite?: number } = {}): Promise<ResultadoEnvio> {
  const vazio: ResultadoEnvio = { enviados: 0, falhas: 0, lotes: 0 };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) return vazio;

  const supabase = createClient(url, anon);
  const maxMs = opts.maxMs ?? 40000;
  const limite = Math.min(Math.max(opts.limite ?? 25, 1), 40);
  const inicio = Date.now();
  const total = { ...vazio };

  // Para antes de estourar o tempo da função: um lote leva alguns segundos.
  while (Date.now() - inicio < maxMs - 15000) {
    const { data, error } = await supabase.rpc("campanha_proximo_lote", { p_secret: secret, p_limite: limite });
    if (error) {
      console.error("[campanhas] erro ao buscar lote:", error.message);
      break;
    }
    const itens = ((data as { itens?: Item[] } | null)?.itens ?? []) as Item[];
    if (itens.length === 0) break;
    total.lotes++;

    // 5 envios em paralelo por vez.
    for (let i = 0; i < itens.length; i += 5) {
      await Promise.all(
        itens.slice(i, i + 5).map(async (item) => {
          try {
            const components = item.usa_nome
              ? [{ type: "body", parameters: [{ type: "text", text: limparVariavel(item.primeiro_nome) }] }]
              : [];
            const resp = (await sendWhatsAppTemplate(
              { phoneNumberId: item.phone_number_id, token: item.access_token },
              item.telefone,
              item.template_nome,
              item.template_idioma,
              components,
            )) as { messages?: { id?: string }[] };
            await supabase.rpc("campanha_registrar_envio", {
              p_secret: secret,
              p_recipient_id: item.recipient_id,
              p_ok: true,
              p_wa_message_id: resp?.messages?.[0]?.id ?? null,
            });
            total.enviados++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "erro_desconhecido";
            await supabase.rpc("campanha_registrar_envio", {
              p_secret: secret,
              p_recipient_id: item.recipient_id,
              p_ok: false,
              p_erro: msg.slice(0, 400),
            });
            if (ERRO_DE_CONTA.test(msg)) {
              await supabase.rpc("record_whatsapp_send_failure", { p_secret: secret, p_tenant_id: item.tenant_id, p_erro: msg.slice(0, 400) });
            }
            total.falhas++;
          }
        }),
      );
    }
  }
  return total;
}

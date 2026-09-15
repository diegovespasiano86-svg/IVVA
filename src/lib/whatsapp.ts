const GRAPH_API_VERSION = "v22.0";

// Credenciais são por tenant (tabela whatsapp_accounts), nunca mais
// globais — cada negócio tem seu próprio número e token.
export type WhatsAppCreds = { phoneNumberId: string; token: string };

// Envia uma mensagem de template via WhatsApp Cloud API. Usado pra primeiro
// contato (fora da janela de 24h) — respostas dentro da janela podem usar
// mensagem de texto livre.
export async function sendWhatsAppTemplate(
  creds: WhatsAppCreds,
  to: string,
  templateName: string,
  languageCode = "en_US",
) {
  const { phoneNumberId, token } = creds;

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: templateName, language: { code: languageCode } },
      }),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao enviar WhatsApp");
  }
  return data;
}

// Mensagem de texto livre — só funciona dentro da janela de 24h desde a
// última mensagem do cliente (regra da própria Meta). Usada quando um
// humano assume a conversa.
export async function sendWhatsAppText(
  creds: WhatsAppCreds,
  to: string,
  text: string,
) {
  const { phoneNumberId, token } = creds;

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao enviar WhatsApp");
  }
  return data;
}

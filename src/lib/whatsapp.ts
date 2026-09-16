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

// Lista interativa (até 10 linhas, cada uma clicável) — usada pra oferecer
// horários de agenda sem o cliente ter que digitar. O `id` de cada linha
// volta no webhook (interactive.list_reply.id) quando a pessoa escolhe.
export async function sendWhatsAppInteractiveList(
  creds: WhatsAppCreds,
  to: string,
  bodyText: string,
  buttonText: string,
  rows: { id: string; title: string; description?: string }[],
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
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: bodyText },
          action: {
            button: buttonText.slice(0, 20),
            sections: [
              {
                rows: rows.slice(0, 10).map((r) => ({
                  id: r.id,
                  title: r.title.slice(0, 24),
                  ...(r.description ? { description: r.description.slice(0, 72) } : {}),
                })),
              },
            ],
          },
        },
      }),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao enviar lista interativa do WhatsApp");
  }
  return data;
}

// Até 3 botões de resposta rápida — usado pro lembrete de confirmação
// ("Confirmar" / "Preciso remarcar"). O `id` de cada botão volta no
// webhook (interactive.button_reply.id).
export async function sendWhatsAppInteractiveButtons(
  creds: WhatsAppCreds,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
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
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: buttons.slice(0, 3).map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
          },
        },
      }),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Falha ao enviar botões interativos do WhatsApp");
  }
  return data;
}

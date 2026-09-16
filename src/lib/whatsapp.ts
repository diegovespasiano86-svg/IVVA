const GRAPH_API_VERSION = "v22.0";

// Credenciais são por tenant (tabela whatsapp_accounts), nunca mais
// globais — cada negócio tem seu próprio número e token.
export type WhatsAppCreds = { phoneNumberId: string; token: string };

// Baixa uma mídia recebida (áudio, imagem) — a Meta manda só o ID no
// webhook, o conteúdo em si precisa de 2 passos: pega a URL temporária,
// depois baixa de lá (a URL sozinha não funciona sem o token de novo).
export async function baixarMidiaWhatsApp(
  mediaId: string,
  token: string,
): Promise<{ base64: string; mimeType: string }> {
  const resInfo = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const info = await resInfo.json();
  if (!resInfo.ok || !info?.url) {
    throw new Error(info?.error?.message ?? "Falha ao obter URL da mídia do WhatsApp");
  }

  const resArquivo = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resArquivo.ok) {
    throw new Error("Falha ao baixar mídia do WhatsApp");
  }
  const buffer = Buffer.from(await resArquivo.arrayBuffer());

  return { base64: buffer.toString("base64"), mimeType: info.mime_type ?? "application/octet-stream" };
}

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

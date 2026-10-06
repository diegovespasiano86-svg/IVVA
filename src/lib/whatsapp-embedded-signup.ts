// Chamadas de API pro fluxo de Embedded Signup / Coexistência — o dono
// clica um botão, escaneia/loga pelo popup da Meta com o número que JÁ usa
// no WhatsApp Business app, e a gente troca o código retornado por um
// token de acesso do usuário do sistema (válido por 60 dias, renovável).

const GRAPH_VERSION = "v26.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class WhatsAppEmbeddedSignupError extends Error {}

// O SDK do JavaScript resolve o popup na própria janela (sem redirect de servidor), então a troca
// do código não leva redirect_uri — é assim que a Meta documenta esse fluxo.
export async function exchangeEmbeddedSignupCode(code: string): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_WHATSAPP_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appId || !appSecret) {
    throw new WhatsAppEmbeddedSignupError("Configuração do app Meta ausente.");
  }

  const url = new URL(`${GRAPH_URL}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const resp = await fetch(url.toString());
  const data = await resp.json();

  if (!resp.ok || !data.access_token) {
    throw new WhatsAppEmbeddedSignupError(
      data?.error?.message ?? "Falha ao trocar o código pelo token de acesso.",
    );
  }

  return data.access_token as string;
}

export async function buscarDetalhesNumero(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ displayPhoneNumber: string | null; verifiedName: string | null }> {
  const url = new URL(`${GRAPH_URL}/${phoneNumberId}`);
  url.searchParams.set("fields", "display_phone_number,verified_name");
  url.searchParams.set("access_token", accessToken);

  const resp = await fetch(url.toString());
  const data = await resp.json();

  if (!resp.ok) {
    // Não é fatal — o número já foi conectado, só não conseguimos o nome
    // "bonito" pra mostrar. Segue com o que tem.
    return { displayPhoneNumber: null, verifiedName: null };
  }

  return {
    displayPhoneNumber: data.display_phone_number ?? null,
    verifiedName: data.verified_name ?? null,
  };
}

// Pede pra Meta começar a mandar os webhooks de sincronização — contatos
// (smb_app_state_sync) e histórico de mensagens dos últimos 180 dias
// (history). Ambos chegam de forma assíncrona pelo webhook, não na
// resposta dessa chamada.
export async function solicitarSincronizacaoCoexistencia(
  phoneNumberId: string,
  accessToken: string,
): Promise<void> {
  const url = `${GRAPH_URL}/${phoneNumberId}/smb_app_data`;

  for (const syncType of ["smb_app_state_sync", "history"] as const) {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          sync_type: syncType,
          access_token: accessToken,
        }),
      });
    } catch (err) {
      // Falha aqui não derruba a conexão — o número já está ativo e
      // recebendo mensagens novas; a sincronização do histórico é só um
      // bônus que dá pra pedir de novo depois.
      console.error(`[embedded-signup] falha ao pedir sync ${syncType}`, err);
    }
  }
}

// Sem isto o app não recebe nenhuma mensagem do número do cliente: a Meta só envia os webhooks
// (mensagens, status, eco do app do celular, histórico) para apps inscritos na conta do WhatsApp
// Business (WABA) do cliente. Precisa rodar logo depois de conectar, e de novo se a conexão for refeita.
export async function inscreverAppNaConta(
  wabaId: string,
  accessToken: string,
): Promise<{ ok: boolean; erro: string | null }> {
  try {
    const resp = await fetch(`${GRAPH_URL}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({}),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.success === false) {
      return { ok: false, erro: data?.error?.message ?? "A Meta não aceitou a inscrição do app." };
    }
    return { ok: true, erro: null };
  } catch (err) {
    console.error("[embedded-signup] falha ao inscrever o app na conta", err);
    return { ok: false, erro: "Não consegui falar com a Meta para ativar o recebimento das mensagens." };
  }
}

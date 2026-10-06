// Chamadas de API pro fluxo de Embedded Signup / Coexistência — o dono
// clica um botão, escaneia/loga pelo popup da Meta com o número que JÁ usa
// no WhatsApp Business app, e a gente troca o código retornado por um
// token de acesso do usuário do sistema (válido por 60 dias, renovável).

const GRAPH_VERSION = "v26.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class WhatsAppEmbeddedSignupError extends Error {}

// Toda chamada à Meta tem limite de tempo: se ela não responder, o dono vê um erro claro em vez de a tela
// ficar "conectando" para sempre.
function graphFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(12000) });
}

// A troca do código do login (SDK do JavaScript) pelo token. A Meta documenta a troca SEM redirect_uri; mesmo
// assim alguns tipos de login exigem o redirect_uri igual ao da janela. Como uma tentativa recusada pode
// invalidar o código, a ordem importa: primeiro o formato documentado (sem o parâmetro) e só depois os outros.
// Cada tentativa fica registrada no erro final, para sabermos exatamente o que a Meta respondeu.
export async function exchangeEmbeddedSignupCode(code: string, paginaUrl?: string): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_WHATSAPP_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appId || !appSecret) {
    throw new WhatsAppEmbeddedSignupError("Configuração do app Meta ausente.");
  }

  let origem: string | null = null;
  try {
    if (paginaUrl) origem = new URL(paginaUrl).origin;
  } catch {
    origem = null;
  }
  const variantes: (string | null)[] = [
    null, // sem o parâmetro (documentado pela Meta)
    "", // parâmetro vazio
    ...(origem ? [origem + "/", origem, paginaUrl ?? ""] : []),
    "https://www.facebook.com/connect/login_success.html",
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const tentativas: string[] = [];
  for (const redirectUri of variantes) {
    const url = new URL(`${GRAPH_URL}/oauth/access_token`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    if (redirectUri !== null) url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code", code);

    const resp = await graphFetch(url.toString());
    const data = await resp.json();
    if (resp.ok && data.access_token) {
      console.log("[embedded-signup] troca do código aceita com redirect_uri =", JSON.stringify(redirectUri));
      return data.access_token as string;
    }
    const msg = String(data?.error?.message ?? "sem mensagem");
    const rotulo = redirectUri === null ? "sem parâmetro" : redirectUri === "" ? "vazio" : redirectUri;
    tentativas.push(`${rotulo}: ${msg} (código ${data?.error?.code ?? "?"}/${data?.error?.error_subcode ?? "-"})`);
    // Segredo errado não muda com outro formato.
    if (/client secret/i.test(msg)) break;
  }

  console.error("[embedded-signup] troca do código recusada", tentativas);
  throw new WhatsAppEmbeddedSignupError(
    `A Meta recusou a troca do código. Tentativas: ${tentativas.join(" | ")}`,
  );
}

export async function buscarDetalhesNumero(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ displayPhoneNumber: string | null; verifiedName: string | null }> {
  const url = new URL(`${GRAPH_URL}/${phoneNumberId}`);
  url.searchParams.set("fields", "display_phone_number,verified_name");
  url.searchParams.set("access_token", accessToken);

  const resp = await graphFetch(url.toString());
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
      await graphFetch(url, {
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
    const resp = await graphFetch(`${GRAPH_URL}/${wabaId}/subscribed_apps`, {
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

type NumeroDaMeta = {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  isCoexistence: boolean;
};

// Quando a janela da Meta fecha sem devolver o número escolhido (acontece quando o cliente já autorizou
// o app antes), o código do login ainda vale: com o token descobrimos quais contas de WhatsApp Business
// (WABA) foram liberadas e qual número está nelas. Prefere o número que vive no app WhatsApp Business
// do celular (coexistência).
export async function descobrirNumeroLiberado(
  accessToken: string,
): Promise<{ numero: NumeroDaMeta | null; erro: string | null }> {
  const appId = process.env.NEXT_PUBLIC_WHATSAPP_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appId || !appSecret) return { numero: null, erro: "Configuração do app Meta ausente." };

  try {
    const dbg = new URL(`${GRAPH_URL}/debug_token`);
    dbg.searchParams.set("input_token", accessToken);
    dbg.searchParams.set("access_token", `${appId}|${appSecret}`);
    const dbgResp = await graphFetch(dbg.toString());
    const dbgData = await dbgResp.json();
    const escopos = (dbgData?.data?.granular_scopes ?? []) as { scope: string; target_ids?: string[] }[];
    const wabaIds = [
      ...new Set(
        escopos
          .filter((s) => s.scope === "whatsapp_business_management" || s.scope === "whatsapp_business_messaging")
          .flatMap((s) => s.target_ids ?? []),
      ),
    ];
    if (wabaIds.length === 0) {
      return { numero: null, erro: "A Meta não liberou nenhuma conta de WhatsApp Business para a ivva." };
    }

    const achados: NumeroDaMeta[] = [];
    for (const wabaId of wabaIds) {
      const url = new URL(`${GRAPH_URL}/${wabaId}/phone_numbers`);
      url.searchParams.set("fields", "id,display_phone_number,is_on_biz_app");
      url.searchParams.set("access_token", accessToken);
      const resp = await graphFetch(url.toString());
      const data = await resp.json();
      for (const n of (data?.data ?? []) as { id: string; display_phone_number?: string; is_on_biz_app?: boolean }[]) {
        achados.push({
          wabaId,
          phoneNumberId: n.id,
          displayPhoneNumber: n.display_phone_number ?? null,
          isCoexistence: n.is_on_biz_app === true,
        });
      }
    }
    if (achados.length === 0) {
      return { numero: null, erro: "Não encontrei nenhum número nas contas de WhatsApp Business liberadas." };
    }
    achados.sort((a, b) => Number(b.isCoexistence) - Number(a.isCoexistence));
    return { numero: achados[0], erro: null };
  } catch (err) {
    console.error("[embedded-signup] falha ao descobrir o número liberado", err);
    return { numero: null, erro: "Não consegui consultar a Meta para achar o número liberado." };
  }
}

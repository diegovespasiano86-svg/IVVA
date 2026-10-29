// Google Agenda: cada agendamento da ivva (robô ou manual) vira um evento na agenda do dono.
// OAuth direto na API do Google (sem SDK). O token de renovação fica criptografado no banco
// (chave derivada do segredo do cliente Google) e só as funções com segredo enxergam.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
export const ESCOPO = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

export function googleConfigurado() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function urlRetorno() {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.ivva.app.br"}/api/google-agenda/callback`;
}

const chave = () => createHash("sha256").update(`ivva-google:${process.env.GOOGLE_CLIENT_SECRET ?? ""}`).digest();

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decifrar(valor: string): string {
  const [iv, tag, enc] = valor.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

/** "state" assinado: amarra o retorno do Google ao usuário que clicou em Conectar (vale 10 min). */
export function assinarState(userId: string): string {
  const corpo = `${userId}.${Date.now()}`;
  const mac = createHmac("sha256", chave()).update(corpo).digest("hex").slice(0, 32);
  return `${corpo}.${mac}`;
}

export function lerState(state: string): string | null {
  const [userId, ts, mac] = state.split(".");
  if (!userId || !ts || !mac) return null;
  const esperado = createHmac("sha256", chave()).update(`${userId}.${ts}`).digest("hex").slice(0, 32);
  if (esperado !== mac || Date.now() - Number(ts) > 10 * 60 * 1000) return null;
  return userId;
}

export function urlAutorizacao(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: urlRetorno(),
    response_type: "code",
    scope: ESCOPO,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH}?${p}`;
}

export async function trocarCodigo(code: string): Promise<{ refresh_token?: string; access_token: string }> {
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: urlRetorno(),
      grant_type: "authorization_code",
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description ?? j.error ?? "Falha ao conectar com o Google");
  return j;
}

async function tokenDeAcesso(refresh: string): Promise<string> {
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!r.ok) {
    const e = new Error(j.error_description ?? j.error ?? "Falha ao renovar acesso") as Error & { revogado?: boolean };
    e.revogado = j.error === "invalid_grant";
    throw e;
  }
  return j.access_token as string;
}

export async function emailDoGoogle(accessToken: string): Promise<string | null> {
  const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return null;
  return ((await r.json()) as { email?: string }).email ?? null;
}

type Pendencia = {
  appointment_id: string;
  acao: "criar" | "atualizar" | "apagar";
  event_id: string | null;
  versao: string;
  data_hora: string;
  duracao_minutos: number | null;
  servico: string | null;
  observacoes: string | null;
  contato_nome: string;
  contato_telefone: string | null;
  contato_email: string | null;
  profissional_nome: string | null;
};

function corpoEvento(p: Pendencia, convidar: boolean) {
  const ini = new Date(p.data_hora);
  const fim = new Date(ini.getTime() + (p.duracao_minutos ?? 30) * 60000);
  const detalhes = [p.servico ? `Serviço: ${p.servico}` : null, p.contato_telefone ? `Telefone: ${p.contato_telefone}` : null, p.observacoes, "Agendado pela ivva"]
    .filter(Boolean)
    .join("\n");
  return {
    summary: `${p.servico ? p.servico + " · " : ""}${p.contato_nome}`,
    description: detalhes,
    start: { dateTime: ini.toISOString() },
    end: { dateTime: fim.toISOString() },
    ...(convidar && p.contato_email ? { attendees: [{ email: p.contato_email }] } : {}),
  };
}

/** Link "Adicionar ao Google Agenda" para o cliente (não precisa de login do dono). */
export function linkAdicionarAgenda(p: { titulo: string; inicioIso: string; duracaoMin: number; detalhes?: string }): string {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ini = new Date(p.inicioIso);
  const fim = new Date(ini.getTime() + p.duracaoMin * 60000);
  const q = new URLSearchParams({ action: "TEMPLATE", text: p.titulo, dates: `${f(ini)}/${f(fim)}`, details: p.detalhes ?? "" });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/**
 * Envia para o Google tudo que mudou desde a última vez, para as agendas ligadas do negócio.
 * Nunca lança erro: uma falha aqui não pode atrapalhar o agendamento nem a resposta ao cliente.
 */
export async function sincronizarGoogleAgenda(tenantId: string | null): Promise<{ criados: number; atualizados: number; apagados: number }> {
  const total = { criados: 0, atualizados: 0, apagados: 0 };
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!googleConfigurado() || !secret || !url || !anon) return total;
  const sb = createClient(url, anon);

  try {
    const { data: conexoes } = await sb.rpc("google_agenda_conexoes_ativas", { p_secret: secret, p_tenant_id: tenantId });
    for (const c of (conexoes ?? []) as { id: string; convidar_cliente: boolean; refresh_token_enc: string }[]) {
      try {
        const { data: pend } = await sb.rpc("google_agenda_pendencias", { p_secret: secret, p_conexao_id: c.id });
        const lista = (pend ?? []) as Pendencia[];
        if (lista.length === 0) continue;
        const acesso = await tokenDeAcesso(decifrar(c.refresh_token_enc));
        const h = { authorization: `Bearer ${acesso}`, "content-type": "application/json" };
        for (const p of lista) {
          if (p.acao === "apagar" && p.event_id) {
            const r = await fetch(`${API}/${p.event_id}`, { method: "DELETE", headers: h });
            if (r.ok || r.status === 404 || r.status === 410) {
              await sb.rpc("google_agenda_marcar", { p_secret: secret, p_conexao_id: c.id, p_appointment_id: p.appointment_id, p_event_id: p.event_id, p_versao: p.versao, p_apagado: true });
              total.apagados++;
            }
            continue;
          }
          const corpo = JSON.stringify(corpoEvento(p, c.convidar_cliente));
          const sendUpdates = c.convidar_cliente ? "?sendUpdates=all" : "";
          const r =
            p.acao === "atualizar" && p.event_id
              ? await fetch(`${API}/${p.event_id}${sendUpdates}`, { method: "PATCH", headers: h, body: corpo })
              : await fetch(`${API}${sendUpdates}`, { method: "POST", headers: h, body: corpo });
          if (!r.ok) continue;
          const ev = (await r.json()) as { id: string };
          await sb.rpc("google_agenda_marcar", { p_secret: secret, p_conexao_id: c.id, p_appointment_id: p.appointment_id, p_event_id: ev.id, p_versao: p.versao });
          if (p.acao === "criar") total.criados++;
          else total.atualizados++;
        }
      } catch (e) {
        const err = e as Error & { revogado?: boolean };
        console.error("[google-agenda] falha ao sincronizar conexão", c.id, err.message);
        await sb.rpc("google_agenda_erro", {
          p_secret: secret,
          p_conexao_id: c.id,
          p_erro: err.revogado ? "O acesso foi removido no Google. Conecte de novo." : err.message,
          p_desativar: Boolean(err.revogado),
        });
      }
    }
  } catch (e) {
    console.error("[google-agenda] erro geral", e);
  }
  return total;
}

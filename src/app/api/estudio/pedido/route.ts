import { NextResponse } from "next/server";
import { createClient as createAnon } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { enviarEmail } from "@/lib/email";

// Pedido do IVVA Estúdio: vem da landing /estudio-ivva (pública ou aberta dentro do app, mesmo domínio).
// Cliente logado com plano Profissional/Completo = pedido de diagnóstico (prazo de 3 dias úteis);
// os demais = pedido de conversa. Grava em estudio_pedidos e avisa o time por e-mail.
// O campo "empresa" é isca para robô.
const AVISO_PARA = "contato@ivva.app.br";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  const responder = (corpo: object, status = 200) => NextResponse.json(corpo, { status });
  const host = req.headers.get("host");
  const origem = req.headers.get("origin");
  if (origem && host && new URL(origem).host !== host) return responder({ erro: "Origem não permitida." }, 403);

  let c: Record<string, unknown>;
  try {
    c = await req.json();
  } catch {
    return responder({ erro: "Pedido inválido." }, 400);
  }
  const texto = (k: string, max: number) => (typeof c[k] === "string" ? (c[k] as string).trim().slice(0, max) : "");
  if (texto("empresa", 80)) return responder({ ok: true });

  // Quem está logado (a landing dentro do app manda os cookies da sessão).
  type Perfil = { nome: string | null; email: string | null; tenant_id: string | null; tenants: { nome: string | null; plano: string | null } | null };
  let user = null as { id: string; email?: string } | null;
  let perfil = null as Perfil | null;
  try {
    const sb = await createClient();
    const { data } = await sb.auth.getUser();
    if (data.user) {
      user = data.user;
      const { data: p } = await sb.from("users").select("nome, email, tenant_id, tenants(nome, plano)").eq("id", data.user.id).maybeSingle();
      perfil = p as unknown as Perfil | null;
    }
  } catch {
    /* segue como visitante */
  }

  const plano = perfil?.tenants?.plano ?? null;
  const tipo = plano === "profissional" || plano === "completo" ? "diagnostico" : "conversa";
  const nome = texto("nome", 80) || perfil?.nome || "";
  const email = (texto("email", 120) || perfil?.email || user?.email || "").toLowerCase();
  const telefone = texto("telefone", 20);
  const negocio = perfil?.tenants?.nome || texto("negocio", 120);

  if (!user) {
    if (!nome) return responder({ erro: "Diga como podemos te chamar." }, 400);
    if (telefone.replace(/\D/g, "").length < 10) return responder({ erro: "Informe o WhatsApp com DDD." }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return responder({ erro: "Confira o e-mail." }, 400);
  }

  const respostas: Record<string, string> = {};
  const bruto = (c.respostas ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(bruto).slice(0, 8)) if (typeof v === "string") respostas[k.slice(0, 60)] = v.slice(0, 120);
  const utm: Record<string, string> = {};
  const u = (c.utm ?? {}) as Record<string, unknown>;
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "referrer"]) if (typeof u[k] === "string" && u[k]) utm[k] = (u[k] as string).slice(0, 80);

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return responder({ erro: "Pedido indisponível agora. Tente mais tarde." }, 503);
  const anon = createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const instagram = texto("instagram", 80);
  const concorrentes = texto("concorrentes", 300);
  const periodo = texto("periodo", 40);
  const objetivo = texto("objetivo", 600);
  const formatos = texto("formatos", 120);
  const { data: reg, error } = await anon.rpc("estudio_pedido_registrar", {
    p_secret: secret,
    p_tipo: tipo,
    p_origem: user ? "app" : utm.utm_source ? "campanha" : "landing_publica",
    p_tenant: perfil?.tenant_id ?? null,
    p_user: user?.id ?? null,
    p_plano: plano,
    p_nome: nome || null,
    p_email: email || null,
    p_telefone: telefone || null,
    p_negocio: negocio || null,
    p_respostas: respostas,
    p_instagram: instagram || null,
    p_concorrentes: concorrentes || null,
    p_periodo: periodo || null,
    p_utm: utm,
    p_objetivo: objetivo || null,
    p_formatos: formatos || null,
  });
  if (error) {
    console.error("[estudio/pedido]", error.message);
    return responder({ erro: "Não conseguimos registrar agora. Tente de novo em instantes." }, 500);
  }

  const r = (reg ?? {}) as { id?: string; tipo?: string; ja_usado?: boolean };
  const tipoFinal = r.tipo ?? tipo;

  // Aviso ao time (não trava o pedido se o e-mail falhar).
  const linhas = [
    `Tipo: ${tipoFinal === "diagnostico" ? "DIAGNÓSTICO (incluso no plano, prazo 3 dias úteis)" : r.ja_usado ? "Conversa (o diagnóstico deste ciclo já foi usado)" : "Conversa / proposta"}`,
    `Quem: ${nome || "-"} · ${negocio || "-"}`,
    `Plano: ${plano ?? "não cliente"}`,
    `WhatsApp: ${telefone || "-"} · E-mail: ${email || "-"}`,
    `Instagram: ${instagram || "-"}`,
    `Concorrentes: ${concorrentes || "-"}`,
    `Objetivo: ${objetivo || "-"}`,
    `Formatos: ${formatos || "-"}`,
    `Melhor período para a conversa: ${periodo || "-"}`,
    ...Object.entries(respostas).map(([k, v]) => `${k}: ${v}`),
    `Painel: https://app.ivva.app.br/admin/estudio`,
  ];
  const assunto = `[Estúdio] ${tipoFinal === "diagnostico" ? "Diagnóstico" : "Conversa"}: ${negocio || nome || "novo pedido"}`;
  await enviarEmail({
    para: AVISO_PARA,
    assunto,
    texto: linhas.join("\n"),
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6"><h2 style="margin:0 0 12px">${esc(assunto)}</h2><ul style="padding-left:18px">${linhas.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`,
  }).catch(() => null);

  return responder({ ok: true, tipo: tipoFinal, ja_usado: Boolean(r.ja_usado) });
}

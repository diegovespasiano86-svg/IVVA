import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lista VIP da Black Friday: o formulário de ivva.app.br/black-friday grava aqui (o site não tem servidor).
// Sem login; aceita só a origem do site. O campo "empresa" é isca para robô (gente de verdade não vê).
const ORIGENS = new Set(["https://ivva.app.br", "https://www.ivva.app.br", "http://localhost:3000", "http://localhost:3011"]);

function cors(origem: string | null) {
  const h: Record<string, string> = { "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", Vary: "Origin" };
  if (origem && ORIGENS.has(origem)) h["Access-Control-Allow-Origin"] = origem;
  return h;
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const headers = cors(req.headers.get("origin"));
  const responder = (corpo: object, status = 200) => NextResponse.json(corpo, { status, headers });

  let c: Record<string, unknown>;
  try {
    c = await req.json();
  } catch {
    return responder({ erro: "Pedido inválido." }, 400);
  }
  const texto = (k: string, max: number) => (typeof c[k] === "string" ? (c[k] as string).trim().slice(0, max) : "");
  if (texto("empresa", 80)) return responder({ ok: true });

  const nome = texto("nome", 80);
  const email = texto("email", 120).toLowerCase();
  const telefone = texto("telefone", 20);
  if (!nome) return responder({ erro: "Diga como podemos te chamar." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return responder({ erro: "Confira o e-mail." }, 400);
  if (telefone && telefone.replace(/\D/g, "").length < 10) return responder({ erro: "Informe o WhatsApp com DDD." }, 400);

  const origem: Record<string, string> = {};
  const bruto = (c.origem ?? {}) as Record<string, unknown>;
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "referrer"]) {
    if (typeof bruto[k] === "string" && bruto[k]) origem[k] = (bruto[k] as string).slice(0, 80);
  }

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return responder({ erro: "Inscrição indisponível agora. Tente mais tarde." }, 503);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error } = await supabase.rpc("lista_vip_inscrever", {
    p_secret: secret,
    p_campanha: "black-friday-2026",
    p_nome: nome,
    p_email: email,
    p_telefone: telefone || null,
    p_segmento: texto("segmento", 40) || null,
    p_aceita_whatsapp: c.aceita_whatsapp === true,
    p_origem: origem,
  });
  if (error) {
    console.error("[lista-vip]", error.message);
    return responder({ erro: "Não conseguimos registrar agora. Tente de novo em instantes." }, 500);
  }
  return responder({ ok: true });
}

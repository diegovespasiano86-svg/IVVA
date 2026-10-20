import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// API pública para Zapier/n8n/formulários: cria um contato no CRM do negócio dono da chave.
// Autenticação: "Authorization: Bearer ivva_..." (o banco guarda só o hash da chave).
export async function POST(req: Request) {
  const chave = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^ivva_[a-f0-9]{48}$/.test(chave)) return NextResponse.json({ erro: "Chave inválida." }, { status: 401 });

  let corpo: { nome?: unknown; telefone?: unknown; email?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Envie um JSON com nome e telefone." }, { status: 400 });
  }
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) return NextResponse.json({ erro: "Indisponível no momento." }, { status: 503 });

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.rpc("api_contato_criar", {
    p_secret: secret,
    p_hash: createHash("sha256").update(chave).digest("hex"),
    p_nome: texto(corpo.nome, 120),
    p_telefone: texto(corpo.telefone, 30),
    p_email: texto(corpo.email, 200),
  });
  if (error) {
    console.error("[api-v1-contatos] falha", error.message);
    return NextResponse.json({ erro: "Não foi possível salvar agora." }, { status: 500 });
  }
  const r = data as { ok: boolean; motivo?: string; id?: string; criado?: boolean };
  if (!r.ok) {
    if (r.motivo === "chave_invalida") return NextResponse.json({ erro: "Chave inválida ou revogada." }, { status: 401 });
    return NextResponse.json({ erro: "Dados inválidos: envie nome e telefone com DDD, ex.: (11) 99999-9999." }, { status: 422 });
  }
  return NextResponse.json({ id: r.id, criado: r.criado }, { status: r.criado ? 201 : 200 });
}

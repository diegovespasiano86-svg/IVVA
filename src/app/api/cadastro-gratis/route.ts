import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSegmento } from "@/lib/segmentos";
import { origemDoApp } from "@/lib/origem";
import { TESTE_GRATIS } from "@/lib/teste-gratis";

// Formulário único da página IVVA BLACK (ivva.app.br/60-dias): cria o acesso sem cartão e dispara o e-mail de
// confirmação. O negócio só é montado depois do clique no e-mail (/bem-vindo/gratis).
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

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return responder({ erro: "Cadastro indisponível agora. Tente mais tarde." }, 503);

  // Implícito (sem PKCE): o link do e-mail precisa funcionar em qualquer aparelho, não só no que preencheu a página.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
  });
  const email = texto("email", 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return responder({ erro: "Confira o e-mail." }, 400);
  const emailRedirectTo = `${await origemDoApp()}/auth/callback?next=/bem-vindo/gratis`;

  if (texto("acao", 20) === "reenviar") {
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo } });
    if (error) {
      console.error("[cadastro-gratis] reenvio", error.message);
      return responder({ erro: "Não deu para reenviar agora. Espere um minuto e tente de novo." }, 429);
    }
    return responder({ ok: true });
  }

  if (Date.now() >= TESTE_GRATIS.inscricoesAte) return responder({ erro: "A IVVA BLACK terminou em 31/12." }, 410);

  const nome = texto("nome", 80);
  const negocio = texto("negocio", 120);
  const telefone = texto("telefone", 20).replace(/\D/g, "");
  const segmento = texto("segmento", 40);
  const senha = typeof c.senha === "string" ? c.senha : "";
  if (nome.length < 2) return responder({ erro: "Diga o seu nome." }, 400);
  if (telefone.length < 10 || telefone.length > 13) return responder({ erro: "Informe o WhatsApp com DDD." }, 400);
  if (negocio.length < 2) return responder({ erro: "Informe o nome do negócio." }, 400);
  if (!getSegmento(segmento)) return responder({ erro: "Escolha o tipo do negócio." }, 400);
  if (senha.length < 8 || senha.length > 72) return responder({ erro: "A senha precisa de pelo menos 8 caracteres." }, 400);
  if (c.aceite !== true) return responder({ erro: "Aceite o contrato e os termos para continuar." }, 400);

  const jaTemConta = `Esse e-mail já tem conta na ivva. Entre em app.ivva.app.br/login ou use outro e-mail.`;
  const { data: preparo, error: erroPreparo } = await supabase.rpc("cadastro_preparar", { p_secret: secret, p_email: email });
  if (erroPreparo) {
    console.error("[cadastro-gratis] preparar", erroPreparo.message);
    return responder({ erro: "Não conseguimos registrar agora. Tente de novo em instantes." }, 500);
  }
  if (preparo === "conta_existente") return responder({ erro: jaTemConta }, 409);

  const { data: livre, error: erroLivre } = await supabase.rpc("teste_gratis_livre", { p_secret: secret, p_email: email, p_telefone: telefone });
  if (erroLivre) {
    console.error("[cadastro-gratis] conferir", erroLivre.message);
    return responder({ erro: "Não conseguimos registrar agora. Tente de novo em instantes." }, 500);
  }
  if (livre !== "livre") {
    return responder({ erro: `Esse ${livre === "email_usado" ? "e-mail" : "WhatsApp"} já usou o período grátis. Fale com a gente no (11) 92740-9320.` }, 409);
  }

  const origem: Record<string, string> = {};
  const bruto = (c.origem ?? {}) as Record<string, unknown>;
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "referrer"]) {
    if (typeof bruto[k] === "string" && bruto[k]) origem[k] = (bruto[k] as string).slice(0, 80);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      emailRedirectTo,
      data: { nome, negocio, telefone, segmento, entrada: TESTE_GRATIS.origem, aceite_em: new Date().toISOString() },
    },
  });
  if (error || !data.user) {
    console.error("[cadastro-gratis] signUp", error?.message);
    return responder({ erro: "Não deu para criar o acesso agora. Tente de novo em alguns minutos." }, 500);
  }
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) return responder({ erro: jaTemConta }, 409);

  // Registro do interessado (é o que cria o contato no CRM da ivva). Falha aqui não desfaz o cadastro.
  const { error: erroLista } = await supabase.rpc("lista_vip_inscrever", {
    p_secret: secret,
    p_campanha: "lista-60-dias",
    p_nome: nome,
    p_email: email,
    p_telefone: telefone,
    p_segmento: getSegmento(segmento)?.nome ?? segmento,
    p_aceita_whatsapp: true,
    p_origem: origem,
  });
  if (erroLista) console.error("[cadastro-gratis] lista", erroLista.message);

  return responder({ ok: true });
}

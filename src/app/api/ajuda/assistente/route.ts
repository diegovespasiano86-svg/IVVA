import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guiasDoPerfil } from "@/lib/ajuda-busca";

// Assistente de ajuda dentro do sistema: responde dúvidas de uso com base nos
// guias da própria ivva (src/lib/guias.ts). Só explica e indica a tela; não
// executa nada na conta. Fetch direto na Messages API, como resumo-conversas.ts.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.AJUDA_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

// limite simples por usuário (melhor esforço; em serverless cada instância tem o seu)
const JANELA_MS = 10 * 60 * 1000;
const MAX_POR_JANELA = 20;
const usos = new Map<string, number[]>();

function dentroDoLimite(id: string) {
  const agora = Date.now();
  const recentes = (usos.get(id) ?? []).filter((t) => agora - t < JANELA_MS);
  if (recentes.length >= MAX_POR_JANELA) {
    usos.set(id, recentes);
    return false;
  }
  recentes.push(agora);
  usos.set(id, recentes);
  return true;
}

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta para usar o assistente." }, { status: 401 });
  if (!dentroDoLimite(user.id)) {
    return NextResponse.json({ erro: "Muitas perguntas em pouco tempo. Tente de novo em alguns minutos." }, { status: 429 });
  }

  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return NextResponse.json({ erro: "O assistente está indisponível no momento." }, { status: 503 });

  let corpo: { mensagens?: Msg[] };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const mensagens = (corpo.mensagens ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
  if (!mensagens.length || mensagens[mensagens.length - 1].role !== "user") {
    return NextResponse.json({ erro: "Escreva a sua pergunta." }, { status: 400 });
  }

  const { data: perfil } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  const guias = guiasDoPerfil(perfil?.role === "dono");
  const manual = guias
    .map((g) => `## ${g.titulo} (tela: ${g.href})\n${g.resumo}\n${g.passos.map((p, i) => `${i + 1}. ${p}`).join("\n")}`)
    .join("\n\n");

  const system = `Você é o assistente de ajuda da ivva, um sistema que atende clientes pelo WhatsApp com um robô, agenda horários e organiza o negócio. Você conversa com o dono ou a equipe de um negócio local, gente que não é técnica.

Regras:
- Responda em português do Brasil, simples e curto (até 6 linhas), no tom de quem ajuda um colega.
- Use SOMENTE o manual abaixo. Se a resposta não estiver nele, diga que não tem certeza e indique o botão "Falar com o suporte" (menu do nome, no topo, ou tela Aprender), que abre o WhatsApp do suporte (11) 92740-9320, ou o e-mail contato@ivva.app.br. Nunca invente botões, telas, preços ou prazos.
- Quando indicar uma tela, escreva o link no formato [nome da tela](/rota), usando só as rotas do manual. Se houver vídeo para o assunto, lembre que existe em [Central de ajuda](/ajuda).
- Você só explica; não consegue alterar nada na conta da pessoa.

MANUAL
${manual}`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, system, messages: mensagens }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[ajuda-assistente] falha na API", data?.error);
      return NextResponse.json({ erro: "Não consegui responder agora. Tente de novo em instantes." }, { status: 502 });
    }
    const resposta = ((data.content ?? []) as { type: string; text?: string }[])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    return NextResponse.json({ resposta: resposta || "Não consegui responder. Pode reformular a pergunta?" });
  } catch (e) {
    console.error("[ajuda-assistente]", e);
    return NextResponse.json({ erro: "Não consegui responder agora. Tente de novo em instantes." }, { status: 502 });
  }
}

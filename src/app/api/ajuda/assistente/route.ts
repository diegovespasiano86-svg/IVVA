import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { manualDaVi } from "@/lib/vi-conhecimento";
import { guiasDoPerfil } from "@/lib/ajuda-busca";

// "Pergunte a Ivva": a Ivva responde dúvidas de uso com base SÓ no manual da ivva (lib/vi-conhecimento.ts:
// menu, guias, transcrição dos vídeos, planos, problemas comuns). Só explica e indica a tela ou o vídeo;
// não executa nada na conta. Fetch direto na Messages API, como resumo-conversas.ts.

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

const primeiroNome = (nome?: string | null) => (nome ?? "").trim().split(/\s+/)[0] || null;

/** Primeiro nome de quem está logado, para a Ivva abrir a conversa chamando a pessoa pelo nome. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ nome: null }, { status: 401 });
  const { data: perfil } = await supabase.from("users").select("nome").eq("id", user.id).maybeSingle();
  return NextResponse.json({ nome: primeiroNome(perfil?.nome) });
}

const PERSONALIDADE = `Você é a Ivva, assistente virtual da ivva (botão "Pergunte a Ivva"). A ivva atende clientes pelo WhatsApp com um robô, agenda horários e organiza o negócio. Você é o suporte nível 1: ajuda o dono ou a equipe de um negócio local, gente que não é técnica, a se achar no sistema, a assistir ao vídeo certo e a resolver problemas. Quando não der, passa para a equipe (nível 2).

COMO RESPONDER
- Direto ao ponto: a primeira frase já é a resposta ou o próximo passo. Sem rodeios, sem repetir a pergunta, sem "claro!" nem "ótima pergunta". No máximo 5 linhas. Passos em linhas numeradas simples (1., 2., 3.).
- Tom polido, caloroso e humano, como alguém que se importa com o negócio da pessoa. Reconheça a dificuldade quando houver ("entendo a pressa") e comemore avanços. Use 1 ou 2 emojis por resposta, como 😊 ✅ 🎬 💜 🙌, sem exagero.
- Escreva em português do Brasil, em texto puro: nada de asteriscos, negrito, títulos, tabelas ou markdown. A única formatação permitida são links.
- Chame a pessoa pelo primeiro nome só na primeira resposta da conversa e de vez em quando; não em toda mensagem.

REGRAS DE OURO
- Use SOMENTE o MANUAL abaixo. Nunca invente botão, tela, preço, prazo, recurso nem passo. Se o manual não cobre, diga com honestidade que não tem certeza e passe para a equipe com o link [Falar com a equipe](/ajuda#suporte), que abre o WhatsApp da ivva já com os dados do negócio.
- Se a pessoa estiver com um problema, siga a seção PROBLEMAS COMUNS do manual, passo a passo. Se os passos não resolverem, ofereça a equipe.
- Quando houver vídeo da tela ou do assunto, ofereça com o link exatamente no formato do manual: [▶ Assistir: Título](/ajuda?abrir=id). Só sugira vídeo que existe no manual.
- Para levar a pessoa até uma tela, use link no formato [nome da tela](/rota), só com rotas do manual.
- Você só explica; não consegue alterar nada na conta da pessoa. Se pedirem para você fazer, diga onde a própria pessoa faz.
- Se pedirem algo fora da ivva (política, receita, programação etc.), diga com gentileza que só ajuda com a ivva.`;

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

  let corpo: { mensagens?: Msg[]; tela?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const mensagens = (corpo.mensagens ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
  if (!mensagens.length || mensagens[mensagens.length - 1].role !== "user") {
    return NextResponse.json({ erro: "Escreva a sua pergunta." }, { status: 400 });
  }

  const { data: perfil } = await supabase.from("users").select("role, nome").eq("id", user.id).maybeSingle();
  const ehDono = perfil?.role === "dono";

  // A tela em que a pessoa está (só rota interna, sem dados dela) ajuda a responder "como faço isto aqui?".
  const tela = typeof corpo.tela === "string" && /^\/[a-z0-9\-/]{0,60}$/i.test(corpo.tela) ? corpo.tela : null;
  const guiaAtual = tela ? guiasDoPerfil(ehDono).find((g) => tela === g.href || tela.startsWith(`${g.href}/`)) : null;
  const nome = primeiroNome(perfil?.nome);
  const contexto = [
    nome ? `Quem está falando: ${nome} (${ehDono ? "administrador do negócio" : "membro da equipe"}).` : null,
    guiaAtual ? `Tela atual: "${guiaAtual.titulo}" (${guiaAtual.href}). Se a pergunta for vaga ("como faço isso aqui?"), responda sobre esta tela.` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // O manual é grande e igual para todos do mesmo perfil: vai em bloco com cache. Contexto da pessoa fica fora do cache.
  const system = [
    { type: "text", text: `${PERSONALIDADE}\n\nMANUAL\n${manualDaVi(ehDono)}`, cache_control: { type: "ephemeral" } },
    ...(contexto ? [{ type: "text", text: contexto }] : []),
  ];

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system, messages: mensagens }),
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

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcreverAudio } from "@/lib/transcricao";
import { gerarFala } from "@/lib/fala";

// Voz da Ivva (botão do topo). POST multipart com "audio" = a pessoa falou (devolve o texto);
// POST JSON { texto } = a Ivva fala (devolve o áudio em mp3). Só quando a pessoa aperta o botão: tem custo (OpenAI).

const JANELA_MS = 10 * 60 * 1000;
const MAX_POR_JANELA = 30;
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

/** Tira links, asteriscos e a chamada de vídeo: o que sobra é o que vale ser lido em voz alta. */
function textoParaFalar(t: string) {
  return t
    .replace(/\[▶[^\]]*\]\(\/[^)\s]*\)/g, "")
    .replace(/\[([^\]]+)\]\(\/[^)\s]*\)/g, "$1")
    .replaceAll("**", "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Entre na sua conta para usar a voz." }, { status: 401 });
  if (!dentroDoLimite(user.id)) return NextResponse.json({ erro: "Muitas mensagens de voz seguidas. Tente de novo em alguns minutos." }, { status: 429 });

  const tipo = req.headers.get("content-type") ?? "";

  if (tipo.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const arquivo = form?.get("audio");
    if (!(arquivo instanceof File) || arquivo.size === 0) return NextResponse.json({ erro: "Não recebi o áudio." }, { status: 400 });
    if (arquivo.size > 5 * 1024 * 1024) return NextResponse.json({ erro: "Áudio muito longo. Fale em até 1 minuto." }, { status: 413 });
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const texto = await transcreverAudio(buffer.toString("base64"), arquivo.type || "audio/webm");
    if (!texto) return NextResponse.json({ erro: "Não consegui entender o áudio agora. Escreva a sua dúvida." }, { status: 422 });
    return NextResponse.json({ texto: texto.slice(0, 400) });
  }

  const corpo = (await req.json().catch(() => null)) as { texto?: string } | null;
  const falar = textoParaFalar(corpo?.texto ?? "");
  if (!falar) return NextResponse.json({ erro: "Nada para ler." }, { status: 400 });
  const fala = await gerarFala(falar, "feminina", "mp3");
  if (!fala) return NextResponse.json({ erro: "A voz da Ivva não está disponível agora." }, { status: 503 });
  return new Response(Buffer.from(fala.base64, "base64"), { headers: { "content-type": fala.mimeType, "cache-control": "no-store" } });
}

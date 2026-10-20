import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

// Demonstração viva (público, sem login). Custo de IA controlado por limite por visitante (IP com hash)
// e teto diário global, guardados no banco (função demo_registrar_uso). Se o limite não puder ser
// conferido, a demonstração fica fechada (nunca aberta).

const LIMITE_VISITANTE_HORA = 12;
const LIMITE_GLOBAL_DIA = 400;

export function chaveDoVisitante(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "sem-ip";
  const sal = process.env.DEMO_SALT ?? process.env.WHATSAPP_APP_SECRET ?? "ivva-demo";
  return createHash("sha256").update(`${sal}:${ip}`).digest("hex").slice(0, 32);
}

export async function liberarUso(req: Request): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("demo_registrar_uso", {
      p_chave: chaveDoVisitante(req),
      p_limite_visitante: LIMITE_VISITANTE_HORA,
      p_limite_dia_global: LIMITE_GLOBAL_DIA,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

const MODELO_DEMO = process.env.DEMO_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export async function chamarClaude(system: string, mensagens: { role: "user" | "assistant"; content: string }[], maxTokens = 400) {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error("indisponivel");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELO_DEMO, max_tokens: maxTokens, system, messages: mensagens }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("falha-ia");
  return ((data.content ?? []) as { type: string; text?: string }[])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

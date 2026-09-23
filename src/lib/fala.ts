// Texto-para-voz (resposta em áudio do robô) — usa a TTS da OpenAI SE
// houver OPENAI_API_KEY configurada; sem isso, degrada graciosamente
// (devolve null e quem chamou cai pra responder em texto), mesmo padrão
// de src/lib/transcricao.ts.
export async function gerarFala(
  texto: string,
  voz: "masculina" | "feminina" = "feminina",
): Promise<{ base64: string; mimeType: string } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !texto.trim()) return null;

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: voz === "masculina" ? "onyx" : "nova",
      input: texto,
      response_format: "opus",
    }),
  });

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    console.error("[fala] falha na TTS da OpenAI", erro);
    return null;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  // WhatsApp reconhece audio/ogg com codec opus como mensagem de voz de
  // verdade (bolha com forma de onda), não só um anexo de áudio comum.
  return { base64: buffer.toString("base64"), mimeType: "audio/ogg; codecs=opus" };
}

// Transcrição de áudio (mensagens de voz do WhatsApp). Claude não recebe
// áudio direto pela Messages API — precisa de um serviço de
// speech-to-text à parte. Usa OpenAI Whisper SE houver OPENAI_API_KEY
// configurada; sem isso, degrada graciosamente (devolve null e quem
// chamou pede pro cliente escrever) em vez de quebrar o webhook.
export async function transcreverAudio(base64: string, mimeType: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const buffer = Buffer.from(base64, "base64");
  const extensao = mimeType.includes("ogg")
    ? "ogg"
    : mimeType.includes("mp4")
      ? "mp4"
      : mimeType.includes("webm")
        ? "webm"
        : mimeType.includes("wav")
          ? "wav"
          : "bin";

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), `audio.${extensao}`);
  form.append("model", "whisper-1");
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    console.error("[transcricao] falha no Whisper", erro);
    return null;
  }

  const data = await res.json();
  return typeof data?.text === "string" ? data.text.trim() : null;
}

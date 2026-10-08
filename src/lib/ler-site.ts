import { promises as dns } from "node:dns";
import { isIP } from "node:net";

// Lê o texto público de uma página (site do negócio) para a IA extrair fatos.
// Segurança: só http/https, nunca endereços internos (evita usar o servidor para espiar a rede interna),
// no máximo 3 redirecionamentos (cada um revalidado), tempo e tamanho limitados.

const TEMPO_MAX_MS = 10_000;
const TAMANHO_MAX = 2 * 1024 * 1024;
const TEXTO_MAX = 30_000;
const REDIRECIONAMENTOS_MAX = 3;

function ipPrivado(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const l = ip.toLowerCase();
  return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
}

async function validarDestino(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Use um endereço que comece com http:// ou https://");
  if (url.username || url.password) throw new Error("Endereço inválido.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    throw new Error("Esse endereço não pode ser lido.");
  }
  const enderecos = isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => { throw new Error("Não encontrei esse endereço. Confira se digitou certo."); });
  if (enderecos.length === 0 || enderecos.some((e) => ipPrivado(e.address))) throw new Error("Esse endereço não pode ser lido.");
}

/** Normaliza o que a pessoa digitou ("meusite.com.br" vira https://meusite.com.br). */
export function normalizarEndereco(bruto: string): URL | null {
  const t = bruto.trim();
  if (!t || t.length > 300) return null;
  try {
    return new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
}

function htmlParaTexto(html: string): string {
  const titulo = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const descricao = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? "";
  const corpo = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const decodificado = `${titulo}\n${descricao}\n${corpo}`
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
  return decodificado
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1)
    .join("\n")
    .slice(0, TEXTO_MAX);
}

export async function lerTextoDoSite(entrada: string): Promise<{ texto: string; endereco: string }> {
  let url = normalizarEndereco(entrada);
  if (!url) throw new Error("Não entendi esse endereço. Exemplo: meusite.com.br");

  for (let salto = 0; salto <= REDIRECIONAMENTOS_MAX; salto++) {
    await validarDestino(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TEMPO_MAX_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": "ivva-leitor/1.0 (+https://ivva.app.br)", accept: "text/html,text/plain" },
      });
    } catch {
      throw new Error("Não consegui abrir esse endereço. Confira se o site está no ar.");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const destino = res.headers.get("location");
      if (!destino) throw new Error("O site redirecionou para um lugar inválido.");
      url = new URL(destino, url);
      continue;
    }
    if (!res.ok) throw new Error(`O site respondeu com erro (${res.status}).`);
    const tipo = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(tipo)) throw new Error("Esse endereço não é uma página de texto.");

    const leitor = res.body?.getReader();
    if (!leitor) throw new Error("Página vazia.");
    const partes: Uint8Array[] = [];
    let total = 0;
    while (total < TAMANHO_MAX) {
      const { done, value } = await leitor.read();
      if (done || !value) break;
      partes.push(value);
      total += value.byteLength;
    }
    await leitor.cancel().catch(() => {});
    const html = Buffer.concat(partes).toString("utf8");
    const texto = htmlParaTexto(html);
    if (texto.length < 80) throw new Error("A página tem pouco texto (talvez carregue o conteúdo só no navegador). Tente outra página do site.");
    return { texto, endereco: url.toString() };
  }
  throw new Error("O site redirecionou vezes demais.");
}

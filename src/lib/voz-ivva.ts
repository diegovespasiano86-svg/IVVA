// Voz da Ivva: frases fixas gravadas (public/ivva-voz), tocadas em fila. Sem custo por uso e sempre a mesma voz.
// A pessoa pode silenciar pelo ícone de som da conversa; a escolha fica neste navegador.
const CHAVE = "ivva:voz";

export const FRASES = {
  oi: "/ivva-voz/01-oi-eu-sou-a-ivva.mp3",
  sozinho: "/ivva-voz/02-voce-nao-esta-sozinho.mp3",
  base: "/ivva-voz/03-base-de-conhecimento.mp3",
  arquivo: "/ivva-voz/04-arquivo-escrever-ou-falar.mp3",
  depois: "/ivva-voz/05-clientes-catalogo-agenda.mp3",
  chamar: "/ivva-voz/06-me-chamar-o-que-falta.mp3",
  topo: "/ivva-voz/07-estou-no-topo.mp3",
  percebi: "/ivva-voz/08-percebi-que-falta.mp3",
  completou: "/ivva-voz/09-completou-o-essencial.mp3",
  agoraOuDepois: "/ivva-voz/10-completar-agora-ou-depois.mp3",
} as const;

/** Apresentação do popup de boas-vindas, na ordem do texto. */
export const APRESENTACAO = [FRASES.oi, FRASES.sozinho, FRASES.base, FRASES.arquivo, FRASES.depois, FRASES.chamar, FRASES.topo];

export function vozLigada(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== "0";
  } catch {
    return true;
  }
}

export function definirVoz(ligada: boolean) {
  try {
    localStorage.setItem(CHAVE, ligada ? "1" : "0");
  } catch {}
  if (!ligada) pararFrases();
}

let atual: HTMLAudioElement | null = null;
let rodada = 0;

export function pararFrases() {
  rodada++;
  atual?.pause();
  atual = null;
}

/** Toca as frases em fila. Devolve false se o navegador bloqueou o som (precisa de um clique antes). */
export async function tocarFrases(arquivos: string[], aoTerminar?: () => void): Promise<boolean> {
  pararFrases();
  const minha = rodada;
  for (let i = 0; i < arquivos.length; i++) {
    if (minha !== rodada) return true;
    const audio = new Audio(arquivos[i]);
    atual = audio;
    try {
      await audio.play();
    } catch {
      return false;
    }
    await new Promise<void>((ok) => {
      audio.onended = () => ok();
      audio.onerror = () => ok();
      audio.onpause = () => ok();
    });
  }
  if (minha === rodada) {
    atual = null;
    aoTerminar?.();
  }
  return true;
}

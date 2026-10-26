// Canal de suporte da ivva: WhatsApp da empresa. Fonte única do número, das urgências
// (os prazos são os do contrato, cláusula 7) e da mensagem que já chega preenchida.
export const SUPORTE_WHATSAPP = "5511927409320";
export const SUPORTE_WHATSAPP_LABEL = "(11) 92740-9320";
export const SUPORTE_HORARIO = "dias úteis, das 9h às 18h";

export type Urgencia = "critica" | "alta" | "normal";

export const URGENCIAS: { id: Urgencia; nome: string; quando: string; prazo: string }[] = [
  { id: "critica", nome: "Crítica", quando: "O sistema saiu do ar ou o robô parou para todos os clientes", prazo: "até 8 horas úteis" },
  { id: "alta", nome: "Alta", quando: "Um recurso importante não funciona e não há outro jeito de fazer", prazo: "até 24 horas úteis" },
  { id: "normal", nome: "Normal", quando: "Dúvida, ajuste, configuração ou sugestão", prazo: "até 48 horas úteis" },
];

/** Link do WhatsApp do suporte. Sem detalhes, abre com uma saudação simples. */
export function linkSuporte(detalhes?: {
  urgencia: Urgencia;
  mensagem: string;
  negocio?: string;
  plano?: string;
  email?: string;
  tela?: string;
}): string {
  if (!detalhes) return `https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent("Olá! Preciso de ajuda na ivva.")}`;
  const u = URGENCIAS.find((x) => x.id === detalhes.urgencia) ?? URGENCIAS[2];
  const linhas = [
    "Olá! Preciso de ajuda na ivva.",
    "",
    `*Urgência:* ${u.nome} (${u.quando.toLowerCase()})`,
    detalhes.negocio ? `*Negócio:* ${detalhes.negocio}${detalhes.plano ? ` · plano ${detalhes.plano}` : ""}` : "",
    detalhes.email ? `*Quem escreve:* ${detalhes.email}` : "",
    detalhes.tela ? `*Tela:* app.ivva.app.br${detalhes.tela}` : "",
    "",
    `*O que aconteceu:* ${detalhes.mensagem.trim()}`,
  ].filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""));
  return `https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(linhas.join("\n"))}`;
}

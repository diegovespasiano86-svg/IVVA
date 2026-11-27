import { CONVITE_60 } from "@/lib/planos";

// IVVA BLACK: quem manda "Quero meu acesso IVVA BLACK" no WhatsApp da própria ivva recebe o link do cadastro na hora,
// sem IA (não consome conversas) e sem depender de ninguém. O convite continua sendo conferido na hora de assinar.
const TENANT_IVVA = "0068a35c-98f6-4fd7-9f32-8eeee375381e";
const PEDIDO = /quero\s+(o\s+)?meu\s+acesso\s+(à\s+|a\s+|da\s+)?ivva\s*black/i;

export const pediuAcessoBlack = (texto: string) => PEDIDO.test(texto);
export const ehNumeroDaIvva = (tenantId: string) => tenantId === TENANT_IVVA;

export function respostaAcessoBlack(nome: string | null) {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0];
  const link = `https://app.ivva.app.br/planos?convite=${CONVITE_60.codigo}&utm_source=whatsapp&utm_medium=lista60&utm_campaign=ivva-black`;
  return [
    `Oi${primeiro ? `, ${primeiro}` : ""}! Aqui está o seu acesso aos 60 dias grátis da IVVA BLACK 🎉`,
    link,
    "É só preencher e cadastrar o cartão: hoje você paga R$ 0. Use o mesmo e-mail ou WhatsApp que você informou na página.",
    "Se ainda não preencheu, faça isso primeiro em https://ivva.app.br/60-dias",
  ].join("\n\n");
}

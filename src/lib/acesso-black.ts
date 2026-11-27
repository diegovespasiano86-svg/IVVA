// IVVA BLACK: quem manda "Quero meu acesso IVVA BLACK" no WhatsApp da própria ivva recebe o link do cadastro na hora,
// sem IA (não consome conversas) e sem depender de ninguém. A entrada é sempre pela página /60-dias.
const TENANT_IVVA = "0068a35c-98f6-4fd7-9f32-8eeee375381e";
const PEDIDO = /quero\s+(o\s+)?meu\s+acesso\s+(à\s+|a\s+|da\s+)?ivva\s*black/i;

export const pediuAcessoBlack = (texto: string) => PEDIDO.test(texto);
export const ehNumeroDaIvva = (tenantId: string) => tenantId === TENANT_IVVA;

export function respostaAcessoBlack(nome: string | null) {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0];
  return [
    `Oi${primeiro ? `, ${primeiro}` : ""}! Que bom ter você na IVVA BLACK 🎉 São 60 dias grátis, sem cartão para começar.`,
    "Se ainda não preencheu, é um formulário só: https://ivva.app.br/60-dias?f=whatsapp#acesso",
    "Já preencheu? Abra o e-mail que enviamos e toque no botão de confirmação (veja também o spam). Depois é só entrar: https://app.ivva.app.br/login",
  ].join("\n\n");
}

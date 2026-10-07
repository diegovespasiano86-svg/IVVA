// Pix "copia e cola" (BR Code / EMV do Banco Central) com a chave da própria clínica.
// O dinheiro cai direto na conta de quem recebe; o sistema não confirma sozinho (o dono marca como recebido).

function tlv(id: string, valor: string) {
  return id + String(valor.length).padStart(2, "0") + valor;
}

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// CRC16/CCITT-FALSE exigido pelo padrão.
function crc16(texto: string) {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type DadosPix = { chave: string; beneficiario: string; cidade: string; valor: number; txid?: string };

export function gerarPixCopiaECola({ chave, beneficiario, cidade, valor, txid }: DadosPix): string {
  const nome = semAcento(beneficiario).toUpperCase().slice(0, 25) || "RECEBEDOR";
  const local = semAcento(cidade).toUpperCase().slice(0, 15) || "BRASIL";
  const id = (txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const conta = tlv("00", "br.gov.bcb.pix") + tlv("01", chave.trim());
  const corpo =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("26", conta) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", valor.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", nome) +
    tlv("60", local) +
    tlv("62", tlv("05", id)) +
    "6304";
  return corpo + crc16(corpo);
}

export type TipoChavePix = "documento" | "celular" | "email" | "aleatoria";

/** Limpa e valida a chave conforme o tipo escolhido. Devolve a chave pronta para o BR Code, ou null se inválida. */
export function normalizarChavePix(bruta: string, tipo: TipoChavePix): string | null {
  const t = bruta.trim();
  if (!t) return null;
  if (tipo === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && t.length <= 77 ? t.toLowerCase() : null;
  if (tipo === "aleatoria") return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t) ? t.toLowerCase() : null;
  const digitos = t.replace(/\D/g, "");
  if (tipo === "documento") return digitos.length === 11 || digitos.length === 14 ? digitos : null;
  // celular: com ou sem +55, sempre com DDD
  const sem55 = digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  return sem55.length === 10 || sem55.length === 11 ? "+55" + sem55 : null;
}

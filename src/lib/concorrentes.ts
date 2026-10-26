// Alerta de possível concorrente no /admin (contrato, cláusula 5: uso por concorrentes só com
// autorização). Não bloqueia ninguém sozinho: só aponta quem vale conferir antes de liberar.
// Para incluir uma empresa conhecida, acrescente a marca, o domínio ou o CNPJ (só números) abaixo.

/** Marcas e domínios de quem vende atendimento automatizado, chatbot, CRM ou WhatsApp para empresas. */
const MARCAS = [
  "youze", "leadster", "frontzapp", "manychat", "botconversa", "zenvia", "blip", "take.net", "octadesk",
  "zendesk", "huggy", "poli digital", "polichat", "kommo", "chatfuel", "landbot", "sleekflow", "respond.io",
  "wati", "gupshup", "twilio", "intercom", "freshdesk", "hubspot", "rdstation", "rd station", "pipedrive",
  "z-api", "zapi", "evolution api", "chatwoot", "typebot", "umbler", "digisac", "jivochat", "smarters",
  "botmaker", "aivo", "weni", "sendpulse", "agendor", "ploomes", "leadlovers",
];

/** CNPJs já identificados como concorrentes (só números). */
const CNPJS: string[] = [];

/** Palavras no nome do negócio que indicam quem desenvolve ou revende esse tipo de solução. */
const PALAVRAS = [
  "chatbot", "chat bot", "bot", "bots", "robo", "robos", "automacao", "automacoes", "agencia", "marketing digital",
  "software", "sistemas", "tecnologia", "tech", "crm", "saas", "desenvolvimento", "dev", "ia", "ai",
  "inteligencia artificial", "whatsapp", "zap", "atendimento digital", "consultoria",
];

/** Pedaços que contam mesmo colados a outra palavra (ex.: "ZapBot", "iatech"). "bot" fica de fora por causa de "Botox". */
const PEDACOS = ["chatbot", "zap", "tech", "automac", "software", "whats"];

function normal(t: string | null | undefined) {
  return (t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Procura o termo como palavra inteira (ex.: "wati" não casa com "watinha"). */
function contem(texto: string, termo: string) {
  const t = normal(termo).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(texto);
}

export type SinalConcorrente = { nivel: "alto" | "conferir"; motivo: string };

/** Diz por que um cadastro parece de concorrente, ou null se não há sinal. */
export function sinalConcorrente(c: {
  email?: string | null;
  nomeNegocio?: string | null;
  cpfCnpj?: string | null;
}): SinalConcorrente | null {
  const doc = (c.cpfCnpj ?? "").replace(/\D/g, "");
  if (doc && CNPJS.includes(doc)) return { nivel: "alto", motivo: "CNPJ na lista de concorrentes" };

  const dominio = normal((c.email ?? "").split("@")[1]);
  const nome = normal(c.nomeNegocio);
  for (const m of MARCAS) {
    if (dominio && contem(dominio, m)) return { nivel: "alto", motivo: `E-mail da ${m}` };
    if (contem(nome, m)) return { nivel: "alto", motivo: `Nome do negócio cita ${m}` };
  }
  const palavra = PALAVRAS.find((p) => contem(nome, p) || (dominio && contem(dominio.split(".")[0], p)));
  if (palavra) return { nivel: "conferir", motivo: `Nome ou e-mail com "${palavra.trim()}"` };
  const pedaco = PEDACOS.find((p) => nome.includes(p) || dominio.split(".")[0].includes(p));
  if (pedaco) return { nivel: "conferir", motivo: `Nome ou e-mail com "${pedaco}"` };
  return null;
}

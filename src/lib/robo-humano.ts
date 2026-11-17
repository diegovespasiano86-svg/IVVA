// Observador e relógios do atendimento humano (a ivva acompanha a conversa do administrador).
// Tudo aqui é PURO e testável, menos observarConversa (chama a IA).
//
// Regras combinadas com o dono (17/11/2026), todas dentro da janela de 24 h do WhatsApp
// (mensagem livre, sem modelo da Meta, sem custo extra):
//   15 min depois da última mensagem do administrador -> o robô lê e anota (observar)
//   1 h  e conversa resolvida                          -> pergunta se pode encerrar
//   8 h  e aguardando o cliente                        -> lembrete gentil (uma vez)
//   21 h depois da última msg do CLIENTE               -> aviso de encerramento e encerra
//   sem janela aberta                                  -> encerra em silêncio, sem enviar nada

export type LinhaPendente = {
  conversation_id: string;
  tenant_id: string;
  contact_id: string;
  status: "bot" | "humano";
  humano_ultima_em: string | null;
  humano_revisado_em: string | null;
  humano_situacao: "resolvido" | "aguardando_cliente" | null;
  lembrete_humano_em: string | null;
  encerramento_perguntado_em: string | null;
  aviso_encerramento_em: string | null;
  contact_nome: string | null;
  contact_telefone: string;
  contact_email: string | null;
  contact_nascimento: string | null;
  aceita_mensagem_automatica: boolean;
  tenant_nome: string;
  phone_number_id: string | null;
  access_token: string | null;
  ultima_msg_em: string | null;
  ultima_msg_remetente: "bot" | "humano" | "contato" | null;
  ultima_cliente_em: string | null;
  transcript: string | null;
};

export type Acao =
  | "observar"
  | "perguntar_encerrar"
  | "lembrete"
  | "avisar_encerrar"
  | "encerrar_silencio";

const MIN = 60_000;
const HORA = 60 * MIN;

export const PRAZOS = {
  observarApos: 15 * MIN,
  perguntarEncerrarApos: 60 * MIN,
  lembreteApos: 8 * HORA,
  avisoAposCliente: 21 * HORA,
  janela: 24 * HORA,
  janelaSegura: 23.5 * HORA, // margem pra não mandar no último minuto
  perguntaSemRespostaApos: 22 * HORA,
};

// Horário de São Paulo (sem horário de verão desde 2019).
function horaMinutoSP(d: Date) {
  const h = (d.getUTCHours() + 24 - 3) % 24;
  return { h, m: d.getUTCMinutes() };
}

export function emHorarioSilencio(d: Date) {
  const { h } = horaMinutoSP(d);
  return h >= 22 || h < 7;
}

function msAteFimDoSilencio(d: Date) {
  const { h, m } = horaMinutoSP(d);
  if (h >= 22) return (24 - h + 7) * HORA - m * MIN;
  if (h < 7) return (7 - h) * HORA - m * MIN;
  return 0;
}

function ms(iso: string | null | undefined) {
  return iso ? new Date(iso).getTime() : null;
}

/** Decide o que fazer com UMA conversa agora. Devolve null quando é para esperar. */
export function decidirAcao(l: LinhaPendente, agora: Date): Acao | null {
  const t = agora.getTime();

  // O robô perguntou "posso encerrar?" e o cliente não respondeu.
  if (l.status === "bot") {
    const perguntou = ms(l.encerramento_perguntado_em);
    if (perguntou && t - perguntou >= PRAZOS.perguntaSemRespostaApos) return "encerrar_silencio";
    return null;
  }

  // Só age quando a última mensagem foi do administrador. Se o cliente falou por último,
  // quem deve resposta é o administrador: o robô não se mete.
  if (l.ultima_msg_remetente !== "humano") return null;
  const ultima = ms(l.ultima_msg_em);
  if (!ultima) return null;
  const idade = t - ultima;

  if (!l.humano_revisado_em) return idade >= PRAZOS.observarApos ? "observar" : null;

  const ultimaCliente = ms(l.ultima_cliente_em);
  const janelaAberta = ultimaCliente !== null && t - ultimaCliente < PRAZOS.janelaSegura;
  const silencio = emHorarioSilencio(agora);
  const podeEnviar = l.aceita_mensagem_automatica && !!l.phone_number_id && !!l.access_token;

  if (l.humano_situacao === "resolvido") {
    if (idade < PRAZOS.perguntarEncerrarApos) return null;
    if (!janelaAberta || !podeEnviar) return "encerrar_silencio";
    return silencio ? null : "perguntar_encerrar";
  }

  // aguardando o cliente
  const desdeAdmin = t - (ms(l.humano_ultima_em) ?? ultima);
  if (!janelaAberta) return desdeAdmin >= PRAZOS.janela ? "encerrar_silencio" : null;
  if (!podeEnviar) return t - (ultimaCliente as number) >= PRAZOS.janelaSegura ? "encerrar_silencio" : null;

  const idadeCliente = t - (ultimaCliente as number);
  if (idadeCliente >= PRAZOS.avisoAposCliente) {
    // À noite espera, a não ser que a janela feche antes do fim do silêncio: aí avisa já.
    const restanteJanela = PRAZOS.janela - idadeCliente;
    if (!silencio || restanteJanela <= msAteFimDoSilencio(agora)) return "avisar_encerrar";
    return null;
  }
  if (desdeAdmin >= PRAZOS.lembreteApos && !l.lembrete_humano_em && !silencio) return "lembrete";
  return null;
}

// ---------- textos ----------

export function primeiroNome(nome: string | null | undefined) {
  const n = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!n || /\d/.test(n)) return "";
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function saudacao(nome: string | null | undefined) {
  const n = primeiroNome(nome);
  return n ? `Olá, ${n}! 😊` : "Olá! 😊";
}

export function textoPerguntarEncerrar(nome: string | null, empresa: string) {
  return `${saudacao(nome)} Aqui é a Ivva, agente da ${empresa}. Percebi que o assunto foi finalizado. Tem algo mais em que eu possa ajudar? Posso encerrar nossa conversa?`;
}

export function textoLembrete(nome: string | null, empresa: string) {
  const n = primeiroNome(nome);
  return `${n ? `Oi, ${n}!` : "Oi!"} 😊 Aqui é a Ivva, agente da ${empresa}. Ficou alguma dúvida sobre o que conversamos? Se precisar de ajuda para decidir ou responder, é só me chamar por aqui. 💬`;
}

export function textoAvisoEncerramento(nome: string | null, empresa: string) {
  return `${saudacao(nome)} Aqui é a Ivva, agente da ${empresa}. Como não recebi mais mensagens, vou encerrar nossa conversa por enquanto. Qualquer dúvida é só chamar! 💬`;
}

export function textoEncerradaPeloCliente(nome: string | null) {
  const n = primeiroNome(nome);
  return `Por nada${n ? `, ${n}` : ""}! Qualquer coisa é só chamar por aqui 💜`;
}

// ---------- resposta do cliente à pergunta "posso encerrar?" ----------

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "sim" sozinho NÃO conta: a pergunta tem duas partes ("tem algo mais?" e "posso encerrar?"),
// então um "sim" é ambíguo e segue para o robô esclarecer.
const CONFIRMA = new RegExp(
  "^(" +
    [
      "ok(ay)?",
      "blz",
      "beleza",
      "show",
      "perfeito",
      "otimo",
      "fechado",
      "combinado",
      "valeu",
      "vlw",
      "pode",
      "pode sim",
      "pode encerrar",
      "pode sim encerrar",
      "pode encerrar sim",
      "pode fechar",
      "tudo certo",
      "tudo certinho",
      "tudo resolvido",
      "resolvido",
      "nada mais",
      "(nao )?era so isso",
      "(nao )?so isso",
      "(nao )?so isso mesmo",
      "nao nada mais",
      "nao tudo certo",
      "por enquanto nao",
      "por enquanto e so",
      "nao",
      "nao precisa",
      "nao obrigad[oa]",
      "nao por enquanto",
      "(muito )?obrigad[oa]",
      "obg",
    ].join("|") +
    ")( (muito )?obrigad[oa])?( (pode )?encerrar)?( ate mais| tchau| abracos?)?$",
);

export function ehConfirmacaoEncerramento(texto: string) {
  const t = texto.trim();
  if (!t || t.length > 60 || t.includes("?")) return false;
  if (/^[\p{Extended_Pictographic}\s‍️\u{1F3FB}-\u{1F3FF}]+$/u.test(t)) return true; // só emoji (👍 🙏 …)
  return CONFIRMA.test(normalizar(t));
}

// ---------- observador (IA) ----------

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODELO_BARATO = process.env.ANTHROPIC_MODEL_BARATO ?? "claude-haiku-5-5";

const PROMPT_OBSERVADOR = `Você é a Ivva, assistente de um negócio local. O dono/atendente conversou com um cliente pelo WhatsApp e você só está LENDO a conversa para anotar o que foi combinado. Nunca responda ao cliente.

Devolva SOMENTE um JSON, sem texto antes ou depois:
{"resumo": "...", "situacao": "resolvido" | "aguardando_cliente", "para_conferir": ["..."], "email": "", "data_nascimento": ""}

Regras:
- "resumo": 1 a 3 frases, em português, do que foi combinado (serviço, dia e hora, valor, forma de pagamento, endereço, pedido). Só o que está escrito na conversa.
- "situacao": "resolvido" quando o assunto foi concluído e não há pendência (cliente agradeceu, confirmou, pedido fechado). "aguardando_cliente" quando o atendente perguntou ou pediu algo e depende da resposta do cliente, ou a decisão ainda está em aberto. Na dúvida, "aguardando_cliente".
- "para_conferir": até 4 itens curtos que o dono deve conferir ou lançar na mão (ex.: "Agendar quinta 10h, corte", "Valor combinado R$ 450", "Cliente pagou via Pix"). Vazio se não houver.
- "email" e "data_nascimento" (AAAA-MM-DD): SOMENTE se o próprio cliente escreveu na conversa. Caso contrário, "".
- Nunca invente. Se algo não está claro, deixe de fora.`;

export type Observacao = {
  resumo: string;
  situacao: "resolvido" | "aguardando_cliente";
  paraConferir: string[];
  email: string;
  dataNascimento: string;
};

export async function observarConversa(transcript: string): Promise<Observacao | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELO_BARATO,
        max_tokens: 500,
        system: PROMPT_OBSERVADOR,
        messages: [{ role: "user", content: transcript.slice(-8000) }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[robo-humano] IA recusou", data?.error?.message);
      return null;
    }
    const texto = ((data.content ?? []) as { type: string; text?: string }[])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const m = texto.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : texto);
    return {
      resumo: typeof j.resumo === "string" ? j.resumo.trim().slice(0, 600) : "",
      situacao: j.situacao === "resolvido" ? "resolvido" : "aguardando_cliente",
      paraConferir: Array.isArray(j.para_conferir)
        ? j.para_conferir.filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 4).map((x: string) => x.trim().slice(0, 140))
        : [],
      email: typeof j.email === "string" ? j.email.trim().slice(0, 120) : "",
      dataNascimento: typeof j.data_nascimento === "string" ? j.data_nascimento.trim() : "",
    };
  } catch (err) {
    console.error("[robo-humano] falha ao observar conversa", err);
    return null;
  }
}

export function montarNota(o: Observacao) {
  const partes = [o.resumo];
  if (o.paraConferir.length > 0) partes.push(`Para conferir: ${o.paraConferir.join("; ")}.`);
  return partes.filter(Boolean).join(" ");
}

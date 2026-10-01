// Regras e textos de Campanhas (sem dependência de servidor).

export type StatusCampanha = "rascunho" | "agendada" | "enviando" | "concluida" | "pausada" | "cancelada";

export const STATUS_CAMPANHA: Record<StatusCampanha, { label: string; badge: string }> = {
  rascunho: { label: "Rascunho", badge: "badge-neutral" },
  agendada: { label: "Agendada", badge: "badge-info" },
  enviando: { label: "Enviando", badge: "badge-brand" },
  concluida: { label: "Concluída", badge: "badge-success" },
  pausada: { label: "Pausada", badge: "badge-warn" },
  cancelada: { label: "Cancelada", badge: "badge-danger" },
};

export const STATUS_DESTINATARIO: Record<string, { label: string; badge: string }> = {
  pendente: { label: "Na fila", badge: "badge-neutral" },
  enviando: { label: "Enviando", badge: "badge-brand" },
  enviado: { label: "Enviado", badge: "badge-success" },
  falhou: { label: "Falhou", badge: "badge-danger" },
  ignorado: { label: "Ignorado", badge: "badge-warn" },
};

export const MOTIVO_IGNORADO: Record<string, string> = {
  sem_aceite: "Não aceita mensagens",
  telefone_invalido: "Telefone inválido",
  telefone_duplicado: "Telefone repetido",
  campanha_cancelada: "Campanha cancelada",
  interrompido_sem_confirmacao: "Envio interrompido",
  erro_desconhecido: "Erro desconhecido",
};

export type Segmento = "inativos_60d" | "novos_30d" | "aniversariantes_mes";

export const SEGMENTOS_CAMPANHA: { id: Segmento; label: string; dica: string }[] = [
  { id: "inativos_60d", label: "Sentimos sua falta", dica: "Clientes que já compraram, mas não voltam há mais de 60 dias e não têm horário marcado" },
  { id: "novos_30d", label: "Clientes novos", dica: "Cadastrados nos últimos 30 dias" },
  { id: "aniversariantes_mes", label: "Aniversariantes do mês", dica: "Quem faz aniversário neste mês" },
];

export type Modelo = {
  id: string;
  titulo: string;
  descricao: string;
  nomeModelo: string; // sugestão de nome para criar no Gerenciador do WhatsApp (só a-z, 0-9 e _)
  corpo: string; // {{1}} = primeiro nome
  segmento: Segmento | null; // público sugerido
};

// Textos sem promessa de preço ou desconto: o dono completa o que for oferta ao responder o cliente.
export const MODELOS: Modelo[] = [
  {
    id: "sentimos-falta",
    titulo: "Sentimos sua falta",
    descricao: "Traz de volta quem sumiu há mais de 60 dias.",
    nomeModelo: "ivva_sentimos_sua_falta",
    corpo: "Oi, {{1}}! Faz um tempinho que a gente não te vê por aqui e sentimos sua falta. Que tal marcar um horário? É só responder esta mensagem.",
    segmento: "inativos_60d",
  },
  {
    id: "boas-vindas",
    titulo: "Boas-vindas",
    descricao: "Recebe bem quem acabou de chegar.",
    nomeModelo: "ivva_boas_vindas",
    corpo: "Olá, {{1}}! Que bom ter você com a gente. Qualquer dúvida, ou para agendar o seu horário, é só responder esta mensagem.",
    segmento: "novos_30d",
  },
  {
    id: "aniversario",
    titulo: "Aniversariantes do mês",
    descricao: "Um carinho para quem faz aniversário.",
    nomeModelo: "ivva_aniversario",
    corpo: "Parabéns, {{1}}! 🎉 Neste mês de aniversário preparamos um carinho especial para você. Responda esta mensagem e agende o seu horário.",
    segmento: "aniversariantes_mes",
  },
  {
    id: "retorno",
    titulo: "Hora de voltar",
    descricao: "Convida o cliente para o próximo atendimento.",
    nomeModelo: "ivva_hora_de_voltar",
    corpo: "Oi, {{1}}! Já está na hora de cuidar de você de novo. Quer que eu veja os horários disponíveis desta semana?",
    segmento: "inativos_60d",
  },
  {
    id: "avaliacao",
    titulo: "Pedido de avaliação",
    descricao: "Pede a opinião de quem foi atendido.",
    nomeModelo: "ivva_pedido_avaliacao",
    corpo: "Oi, {{1}}! Sua opinião é muito importante para nós. Pode nos contar como foi a sua experiência? Basta responder esta mensagem.",
    segmento: null,
  },
  {
    id: "novidade",
    titulo: "Novidade ou promoção",
    descricao: "Comunica uma novidade para toda a base.",
    nomeModelo: "ivva_novidade",
    corpo: "Oi, {{1}}! Temos uma novidade para os nossos clientes. Responda esta mensagem para saber os detalhes e garantir o seu horário.",
    segmento: null,
  },
];

export const modeloPorId = (id: string | null | undefined) => MODELOS.find((m) => m.id === id);

export const IDIOMAS = [
  { id: "pt_BR", label: "Português (Brasil)" },
  { id: "en_US", label: "Inglês (EUA)" },
  { id: "es", label: "Espanhol" },
];

/** Troca {{1}} pelo nome de exemplo para a prévia. */
export const previaComNome = (texto: string, nome = "Maria") => texto.replace(/\{\{1\}\}/g, nome);

/** Nome do modelo como a Meta exige: minúsculas, números e "_". */
export function normalizarNomeModelo(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 200);
}

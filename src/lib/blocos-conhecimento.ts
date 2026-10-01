import { getSegmento } from "@/lib/segmentos";

// Temas (blocos) da base de conhecimento. O id é gravado em
// knowledge_base.categoria (a migração só aceita estes valores ou null).
export const CATEGORIAS = [
  { id: "servicos", label: "Serviços", dica: "O que você faz, duração e o que está incluso" },
  { id: "precos", label: "Preços", dica: "Valores e tabelas de preço" },
  { id: "horarios", label: "Horários", dica: "Dias e horas de funcionamento, antecedência" },
  { id: "pagamento", label: "Pagamento", dica: "Pix, cartão, dinheiro, sinal e parcelamento" },
  { id: "politicas", label: "Políticas", dica: "Cancelamento, atrasos, garantias e regras" },
  { id: "promocoes", label: "Promoções", dica: "Pacotes, descontos, fidelidade e indicação" },
  { id: "equipe", label: "Equipe", dica: "Quem atende e especialidades" },
  { id: "faq", label: "Perguntas frequentes", dica: "Dúvidas comuns dos clientes" },
  { id: "outros", label: "Outros", dica: "Qualquer outra informação útil" },
] as const;

export type CategoriaId = (typeof CATEGORIAS)[number]["id"];
export const CATEGORIA_IDS: string[] = CATEGORIAS.map((c) => c.id);

function normalizar(t: string) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Regras simples e previsíveis (a primeira que bater vence). Sem IA, sem custo:
// serve para organizar o que o cliente escreve, sobe em arquivo ou fala.
const REGRAS: { id: CategoriaId; re: RegExp }[] = [
  { id: "pagamento", re: /\b(pix|cartao|credito|debito|dinheiro|boleto|parcel|pagamento|pagar|sinal|maquininha)/ },
  { id: "politicas", re: /\b(cancel|remarc|atras|reembols|garantia|politica|tolerancia|alergi|contraindic|termos|obrigatori|proibid)/ },
  { id: "horarios", re: /\b(horario|funcionam|funcionamento|abrimos|abre |fecha|segunda|terca|quarta|quinta|sexta|sabado|domingo|feriado|antecedencia|chegar)/ },
  { id: "promocoes", re: /\b(promo|desconto|pacote|combo|fidelidade|indicac|cupom|cashback|brinde|plano mensal|assinatura)/ },
  { id: "precos", re: /(r\$|\bcusta|\bvalor|\bpreco|a partir de|\breais\b)/ },
  { id: "equipe", re: /\b(profissional|profissionais|equipe|atendente|especialista|dr\.|dra\.|doutor|doutora|barbeiro|cabeleireir)/ },
  { id: "faq", re: /\b(duvida|pergunta|como funciona|e normal|posso |precisa de)/ },
  { id: "servicos", re: /\b(minutos|duracao|leva |dura |inclui|sessao|sessoes|procedimento|servico|atendimento)/ },
];

export function classificar(texto: string): CategoriaId {
  const n = normalizar(texto);
  for (const r of REGRAS) if (r.re.test(n)) return r.id;
  return "outros";
}

/** Modelo do nicho já separado em blocos (mesmos fatos do onboarding). */
export function blocosDoSegmento(segmentoId: string): { categoria: CategoriaId; conteudo: string }[] {
  const seg = getSegmento(segmentoId);
  if (!seg) return [];
  return seg.baseConhecimento.map((conteudo) => ({ categoria: classificar(conteudo), conteudo }));
}

/** Textos acima disso são "texto corrido": melhor dividir em blocos. */
export const LIMITE_TEXTO_LONGO = 1200;

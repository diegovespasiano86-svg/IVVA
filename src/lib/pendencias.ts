// O que ainda falta o dono cadastrar para o robô atender bem. Alimenta o círculo piscando da Ivva (botão do topo):
// o número do selo e a frase "percebi que ainda falta..." saem desta mesma conta, então nunca divergem.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIAS, classificar, type CategoriaId } from "@/lib/blocos-conhecimento";

export type Pendencia = { id: string; texto: string; href: string; essencial: boolean };
export type Pendencias = { total: number; essenciais: number; urgente: boolean; itens: Pendencia[] };

// Temas da base que o robô precisa ter. Os demais (promoções, equipe, perguntas frequentes) só melhoram as respostas.
const ESSENCIAIS: Partial<Record<CategoriaId, string>> = {
  servicos: "os serviços e a duração de cada um",
  precos: "os preços",
  horarios: "os dias e horários de atendimento",
  pagamento: "as formas de pagamento",
  politicas: "as regras de cancelamento e atraso",
};
const RECOMENDADOS: Partial<Record<CategoriaId, string>> = {
  promocoes: "descontos e promoções (primeira visita, indicação, pacotes)",
  equipe: "quem atende e a especialidade de cada um",
  faq: "as dúvidas que os clientes mais fazem",
};

const ENDERECO = /endereco|\brua\b|avenida|\bav\.|bairro|\bcep\b|como chegar|estacionamento|domicilio|casa do cliente/;

const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lê a base, os profissionais e o WhatsApp do negócio logado (o RLS já limita ao tenant). */
export async function carregarPendencias(supabase: SupabaseClient): Promise<Pendencias> {
  const [{ data: base }, { count: profissionais }, { data: conta }] = await Promise.all([
    supabase.from("knowledge_base").select("conteudo, categoria").limit(1000),
    supabase.from("professionals").select("id", { count: "exact", head: true }),
    supabase.from("whatsapp_accounts").select("status").maybeSingle(),
  ]);

  const temas = new Set<string>();
  let temEndereco = false;
  for (const e of (base ?? []) as { conteudo: string; categoria: string | null }[]) {
    const tema = e.categoria && CATEGORIAS.some((c) => c.id === e.categoria) ? e.categoria : classificar(e.conteudo);
    temas.add(tema);
    if (!temEndereco && ENDERECO.test(normalizar(e.conteudo))) temEndereco = true;
  }

  const itens: Pendencia[] = [];
  for (const [id, texto] of Object.entries(ESSENCIAIS)) {
    if (!temas.has(id)) itens.push({ id, texto, href: "/base-conhecimento", essencial: true });
  }
  if (!temEndereco) itens.push({ id: "endereco", texto: "o endereço e como chegar (ou se atende em domicílio)", href: "/base-conhecimento", essencial: true });
  if ((profissionais ?? 0) === 0) itens.push({ id: "profissional", texto: "quem atende e a agenda", href: "/calendario", essencial: true });
  for (const [id, texto] of Object.entries(RECOMENDADOS)) {
    if (!temas.has(id)) itens.push({ id, texto, href: "/base-conhecimento", essencial: false });
  }

  const essenciais = itens.filter((i) => i.essencial).length;
  // Urgente: o robô já está atendendo no WhatsApp e ainda falta algo essencial.
  return { total: itens.length, essenciais, urgente: essenciais > 0 && conta?.status === "ativo", itens };
}

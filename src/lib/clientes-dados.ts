import type { createClient } from "@/lib/supabase/server";
import { calcularRfv, type Rfv } from "@/lib/clientes";

type Sb = Awaited<ReturnType<typeof createClient>>;

export type ClienteResumo = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  statusFunil: string | null;
  criadoEm: string;
  nascimento: string | null;
  aceita: boolean;
  rfv: Rfv;
  ultimaVisita: string | null;
  visitas: number;
  totalGasto: number;
};

const dia = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Mês (1-12) de uma data AAAA-MM-DD, sem fuso (é data de calendário). */
export const mesDe = (d: string | null) => (d ? Number(d.slice(5, 7)) : null);
export const mesAtualSP = () => Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(5, 7));

/**
 * Base de clientes com RFV calculado. Visita = um dia com pagamento no Checkout
 * ou agendamento concluído (pagamento e agendamento do mesmo dia contam uma vez).
 * Pensado para negócios de pequeno porte (até alguns milhares de clientes).
 */
export async function carregarBase(supabase: Sb): Promise<ClienteResumo[]> {
  const [{ data: contatos }, { data: pagamentos }, { data: agenda }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, nome, telefone, email, status_funil, created_at, data_nascimento, aceita_mensagem_automatica")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("payments").select("contact_id, valor_total, created_at").limit(20000),
    supabase.from("appointments").select("contact_id, data_hora").eq("status", "concluido").limit(20000),
  ]);

  const agora = new Date().getTime();
  const ano = 365 * 86400000;
  const dias = new Map<string, Set<string>>();
  const ultimas = new Map<string, string>();
  const gasto = new Map<string, number>();
  const gasto12m = new Map<string, number>();

  const marca = (id: string, iso: string) => {
    if (!dias.has(id)) dias.set(id, new Set());
    dias.get(id)!.add(dia(iso));
    const u = ultimas.get(id);
    if (!u || iso > u) ultimas.set(id, iso);
  };
  for (const p of pagamentos ?? []) {
    marca(p.contact_id, p.created_at);
    const v = Number(p.valor_total ?? 0);
    gasto.set(p.contact_id, (gasto.get(p.contact_id) ?? 0) + v);
    if (agora - new Date(p.created_at).getTime() <= ano) gasto12m.set(p.contact_id, (gasto12m.get(p.contact_id) ?? 0) + v);
  }
  for (const a of agenda ?? []) marca(a.contact_id, a.data_hora);

  return (contatos ?? []).map((c) => {
    const visitasDias = [...(dias.get(c.id) ?? [])];
    return {
      id: c.id,
      nome: c.nome ?? "Sem nome",
      telefone: c.telefone ?? "",
      email: c.email ?? null,
      statusFunil: c.status_funil ?? null,
      criadoEm: c.created_at,
      nascimento: c.data_nascimento ?? null,
      aceita: c.aceita_mensagem_automatica !== false,
      rfv: calcularRfv({ criadoEm: c.created_at, visitas: visitasDias, valor12m: gasto12m.get(c.id) ?? 0, agora }),
      ultimaVisita: ultimas.get(c.id) ?? null,
      visitas: visitasDias.length,
      totalGasto: gasto.get(c.id) ?? 0,
    };
  });
}

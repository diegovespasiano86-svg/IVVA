// Tarefas e lembretes do CRM: datas no fuso de Brasília e contagens para os avisos.
import type { createClient } from "@/lib/supabase/server";

type Sb = Awaited<ReturnType<typeof createClient>>;

export type TarefaCrm = {
  id: string;
  contact_id: string;
  tipo: "tarefa" | "lembrete";
  titulo: string;
  data: string; // AAAA-MM-DD
  status: "pendente" | "concluida";
};

/** Hoje em Brasília, AAAA-MM-DD (o servidor roda em UTC). */
export function hojeSP(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function fimDoMes(hoje: string): string {
  const [a, m] = hoje.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${a}-${String(m).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

export function fimDaSemana(hoje: string): string {
  // semana de segunda a domingo
  const d = new Date(`${hoje}T12:00:00Z`);
  const dia = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (7 - dia));
  return d.toISOString().slice(0, 10);
}

export function formatarDataCurta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Contagens para o aviso no topo (a RLS já limita ao que o usuário pode ver). */
export async function resumoTarefasCrm(supabase: Sb): Promise<{ hoje: number; atrasadas: number; mes: number }> {
  const hoje = hojeSP();
  const { data } = await supabase
    .from("crm_tarefas")
    .select("data")
    .eq("status", "pendente")
    .lte("data", fimDoMes(hoje))
    .limit(2000);
  const lista = data ?? [];
  return {
    hoje: lista.filter((t) => t.data === hoje).length,
    atrasadas: lista.filter((t) => t.data < hoje).length,
    mes: lista.filter((t) => t.data >= hoje).length,
  };
}

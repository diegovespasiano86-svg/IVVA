import type { createClient } from "@/lib/supabase/server";
import { diaSP, type Dataset, type Periodo } from "@/lib/relatorios";

type Sb = Awaited<ReturnType<typeof createClient>>;

export const TIPOS_DATASET = ["conversas", "agendamentos", "pagamentos", "clientes"] as const;
export type TipoDataset = (typeof TIPOS_DATASET)[number];

export const ROTULO_DATASET: Record<TipoDataset, string> = {
  conversas: "Conversas",
  agendamentos: "Agendamentos",
  pagamentos: "Pagamentos",
  clientes: "Clientes",
};

const LIMITE = 5000;
const STATUS_CONVERSA: Record<string, string> = { bot: "Com o robô", humano: "Com atendente", encerrada: "Encerrada" };
const STATUS_AGENDA: Record<string, string> = { agendado: "Agendado", concluido: "Concluído", cancelado: "Cancelado" };

function dataHora(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

type Contato = { nome: string | null; telefone: string | null } | null;
type Prof = { nome: string | null } | null;

/** Carrega as linhas de um relatório. A RLS do Supabase já isola o negócio de quem pediu. */
export async function carregarDataset(supabase: Sb, tipo: TipoDataset, periodo: Periodo): Promise<Dataset> {
  const desde = periodo.desde.toISOString();
  const sufixo = `${diaSP(periodo.desde)}_a_${diaSP(new Date())}`;

  if (tipo === "conversas") {
    const { data } = await supabase
      .from("conversations")
      .select("created_at, status, handoff_motivo, contacts(nome, telefone)")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(LIMITE);
    return {
      arquivo: `ivva-conversas-${sufixo}`,
      titulo: "Conversas",
      colunas: ["Data", "Cliente", "Telefone", "Situação", "Motivo do encaminhamento"],
      linhas: (data ?? []).map((c) => {
        const ct = c.contacts as unknown as Contato;
        return [dataHora(c.created_at), ct?.nome ?? "", ct?.telefone ?? "", STATUS_CONVERSA[c.status] ?? c.status, c.handoff_motivo ?? ""];
      }),
    };
  }

  if (tipo === "agendamentos") {
    const { data } = await supabase
      .from("appointments")
      .select("data_hora, status, servico, origem, duracao_minutos, contacts(nome, telefone), professionals(nome)")
      .gte("created_at", desde)
      .order("data_hora", { ascending: false })
      .limit(LIMITE);
    return {
      arquivo: `ivva-agendamentos-${sufixo}`,
      titulo: "Agendamentos",
      colunas: ["Data e hora", "Cliente", "Telefone", "Serviço", "Profissional", "Situação", "Origem", "Duração (min)"],
      linhas: (data ?? []).map((a) => {
        const ct = a.contacts as unknown as Contato;
        const pr = a.professionals as unknown as Prof;
        return [
          dataHora(a.data_hora),
          ct?.nome ?? "",
          ct?.telefone ?? "",
          a.servico ?? "",
          pr?.nome ?? "",
          STATUS_AGENDA[a.status] ?? a.status,
          a.origem === "ia" ? "Robô (IA)" : "Manual",
          a.duracao_minutos ?? null,
        ];
      }),
    };
  }

  if (tipo === "pagamentos") {
    const { data } = await supabase
      .from("payments")
      .select("created_at, valor_total, desconto, forma_pagamento, comissao_calculada, sinal_pago, contacts(nome), professionals(nome)")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(LIMITE);
    return {
      arquivo: `ivva-pagamentos-${sufixo}`,
      titulo: "Pagamentos",
      colunas: ["Data", "Cliente", "Profissional", "Forma de pagamento", "Valor total (R$)", "Desconto (R$)", "Comissão (R$)", "Sinal pago (R$)"],
      linhas: (data ?? []).map((p) => {
        const ct = p.contacts as unknown as Contato;
        const pr = p.professionals as unknown as Prof;
        return [
          dataHora(p.created_at),
          ct?.nome ?? "",
          pr?.nome ?? "",
          p.forma_pagamento ?? "",
          Number(p.valor_total ?? 0),
          Number(p.desconto ?? 0),
          Number(p.comissao_calculada ?? 0),
          Number(p.sinal_pago ?? 0),
        ];
      }),
    };
  }

  const { data } = await supabase
    .from("contacts")
    .select("created_at, nome, telefone, email, instagram, status_funil, como_conheceu, tipo_relacionamento, aceita_mensagem_automatica")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(LIMITE);
  return {
    arquivo: `ivva-clientes-${sufixo}`,
    titulo: "Clientes",
    colunas: ["Cadastro", "Nome", "Telefone", "E-mail", "Instagram", "Fase do funil", "Como conheceu", "Relacionamento", "Aceita mensagens automáticas"],
    linhas: (data ?? []).map((c) => [
      dataHora(c.created_at),
      c.nome ?? "",
      c.telefone ?? "",
      c.email ?? "",
      c.instagram ?? "",
      c.status_funil ?? "",
      c.como_conheceu ?? "",
      c.tipo_relacionamento ?? "",
      c.aceita_mensagem_automatica === false ? "Não" : "Sim",
    ]),
  };
}

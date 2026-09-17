import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_LABEL, type CategoriaResumo } from "@/lib/resumo-conversas";

type Periodo = "dia" | "semana" | "mes";

const PERIODO_LABEL: Record<Periodo, string> = {
  dia: "Últimas 24h",
  semana: "Últimos 7 dias",
  mes: "Últimos 30 dias",
};

function cutoffPara(periodo: Periodo) {
  const horas = periodo === "dia" ? 24 : periodo === "semana" ? 24 * 7 : 24 * 30;
  return new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
}

function statusResgate(c: {
  proposta_pendente_em: string | null;
  recuperacao_1_enviada_em: string | null;
  recuperacao_2_enviada_em: string | null;
}) {
  if (!c.proposta_pendente_em) return { texto: "Sem proposta pendente", tom: "faint" as const };
  if (c.recuperacao_2_enviada_em) return { texto: "2º toque enviado", tom: "coral" as const };
  if (c.recuperacao_1_enviada_em) return { texto: "1º toque enviado", tom: "purple" as const };
  return { texto: "Resgate agendado", tom: "teal" as const };
}

export default async function ConversasDashboard({ periodo }: { periodo: Periodo }) {
  const supabase = await createClient();
  const cutoff = cutoffPara(periodo);

  const { data: conversasPeriodo } = await supabase
    .from("conversations")
    .select("id, contact_id, created_at, handoff_motivo")
    .gte("created_at", cutoff);

  const conversaIds = (conversasPeriodo ?? []).map((c) => c.id);

  const { data: resumosPeriodo } = conversaIds.length
    ? await supabase
        .from("conversation_summaries")
        .select(
          "conversation_id, resumo, categoria, desfecho, perguntas_principais, contacts(nome, telefone), conversations(status, proposta_pendente_em, recuperacao_1_enviada_em, recuperacao_2_enviada_em)",
        )
        .in("conversation_id", conversaIds)
    : { data: [] };

  const totalConversas = conversasPeriodo?.length ?? 0;
  const clientesAtendidos = new Set((conversasPeriodo ?? []).map((c) => c.contact_id)).size;
  const escaladoHumano = (conversasPeriodo ?? []).filter((c) => c.handoff_motivo).length;

  const resumos = resumosPeriodo ?? [];
  const fechou = resumos.filter((r) => r.desfecho === "fechou").length;
  const naoFechou = resumos.filter((r) => r.desfecho === "nao_fechou");
  const taxaFechamento = resumos.length > 0 ? Math.round((fechou / resumos.length) * 100) : 0;

  const porCategoria = new Map<string, number>();
  for (const r of resumos) {
    porCategoria.set(r.categoria, (porCategoria.get(r.categoria) ?? 0) + 1);
  }
  const categoriasOrdenadas = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
  const maiorCategoria = Math.max(1, ...categoriasOrdenadas.map(([, v]) => v));

  const perguntasRecentes = resumos
    .flatMap((r) =>
      Array.isArray(r.perguntas_principais)
        ? (r.perguntas_principais as string[]).map((p) => ({ pergunta: p, resumoId: r.conversation_id }))
        : [],
    )
    .slice(0, 10);

  return (
    <div>
      <div className="mb-4 flex gap-1.5">
        {(["dia", "semana", "mes"] as Periodo[]).map((p) => (
          <Link
            key={p}
            href={`/conversas?view=dashboard&periodo=${p}`}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${
              periodo === p ? "bg-ink text-white" : "bg-surface-soft text-ink-soft"
            }`}
          >
            {PERIODO_LABEL[p]}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Clientes atendidos
          </p>
          <p className="font-display text-[26px] font-extrabold">{clientesAtendidos}</p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Conversas
          </p>
          <p className="font-display text-[26px] font-extrabold">{totalConversas}</p>
        </div>
        <div className="card border-purple/35 px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Taxa de fechamento
          </p>
          <p className="font-display text-[26px] font-extrabold text-purple">
            {taxaFechamento}%
          </p>
        </div>
        <div className="card border-coral/35 px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Escalado pro humano
          </p>
          <p className="font-display text-[26px] font-extrabold text-coral">
            {escaladoHumano}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3.5 md:grid-cols-2">
        <div className="card px-5 py-5">
          <p className="mb-4 text-[14px] font-bold">Principal motivo de contato</p>
          {categoriasOrdenadas.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">
              Ainda sem conversas resumidas nesse período — o resumo por IA
              roda 1x por dia, pode levar até 24h pra aparecer.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {categoriasOrdenadas.map(([categoria, qtd]) => (
                <div key={categoria}>
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold">
                      {CATEGORIA_LABEL[categoria as CategoriaResumo] ?? categoria}
                    </span>
                    <span className="text-ink-faint">{qtd}</span>
                  </div>
                  <div className="h-[9px] w-full overflow-hidden rounded-full bg-surface-soft">
                    <div
                      className="h-full rounded-full bg-purple"
                      style={{ width: `${Math.round((qtd / maiorCategoria) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card px-5 py-5">
          <p className="mb-4 text-[14px] font-bold">Perguntas recentes dos clientes</p>
          {perguntasRecentes.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">Ainda sem dados.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {perguntasRecentes.map((p, i) => (
                <li key={i} className="text-[12.5px] text-ink-soft">
                  <Link href={`/conversas/${p.resumoId}`} className="hover:underline">
                    {p.pergunta}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 card px-5 py-5">
        <p className="mb-1 text-[14px] font-bold">
          Não fechou / sumiu — resgate automático
        </p>
        <p className="mb-4 text-[12.5px] text-ink-faint">
          Clientes que perguntaram e não confirmaram. A ivva já tenta
          recuperar sozinha (1º e 2º toque) nos dias seguintes.
        </p>
        {naoFechou.length === 0 ? (
          <p className="text-[12.5px] text-ink-faint">
            Nenhum caso nesse período — ou ainda não resumido.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {naoFechou.map((r) => {
              const contato = r.contacts as unknown as { nome: string; telefone: string } | null;
              const conv = r.conversations as unknown as {
                status: string;
                proposta_pendente_em: string | null;
                recuperacao_1_enviada_em: string | null;
                recuperacao_2_enviada_em: string | null;
              } | null;
              const resgate = conv
                ? statusResgate(conv)
                : { texto: "—", tom: "faint" as const };
              const tomClasse: Record<string, string> = {
                faint: "bg-surface-soft text-ink-faint",
                coral: "bg-coral/10 text-coral",
                purple: "bg-purple/10 text-purple",
                teal: "bg-teal/10 text-teal",
              };
              return (
                <Link
                  key={r.conversation_id}
                  href={`/conversas/${r.conversation_id}`}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3.5 py-2.5 hover:bg-surface-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">
                      {contato?.nome ?? "Contato"}
                    </p>
                    <p className="truncate text-[12px] text-ink-faint">{r.resumo}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${tomClasse[resgate.tom]}`}
                  >
                    {resgate.texto}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

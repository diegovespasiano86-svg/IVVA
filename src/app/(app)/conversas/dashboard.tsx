import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_LABEL, SENTIMENTO_LABEL, type CategoriaResumo, type Sentimento } from "@/lib/resumo-conversas";

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

/** Desempenho do robô: o período vem do seletor de Relatórios (aba "Desempenho do robô"). */
export default async function ConversasDashboard({ desde }: { desde: string }) {
  const supabase = await createClient();
  const cutoff = desde;

  const { data: conversasPeriodo } = await supabase
    .from("conversations")
    .select("id, contact_id, created_at, handoff_motivo")
    .gte("created_at", cutoff);

  const conversaIds = (conversasPeriodo ?? []).map((c) => c.id);

  const { data: resumosPeriodo } = conversaIds.length
    ? await supabase
        .from("conversation_summaries")
        .select(
          "conversation_id, resumo, categoria, desfecho, perguntas_principais, sentimento, interesse, motivo_perda, contacts(nome, telefone), conversations(status, proposta_pendente_em, recuperacao_1_enviada_em, recuperacao_2_enviada_em)",
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

  const porSentimento: Record<Sentimento, number> = { positivo: 0, neutro: 0, negativo: 0 };
  for (const r of resumos) if (r.sentimento && r.sentimento in porSentimento) porSentimento[r.sentimento as Sentimento]++;
  const comSentimento = porSentimento.positivo + porSentimento.neutro + porSentimento.negativo;

  // Funil de perda: o motivo provável e o que os clientes perguntaram nas conversas que não fecharam.
  const contar = (itens: string[]) => {
    const m = new Map<string, number>();
    for (const i of itens) {
      const k = i.trim().toLowerCase();
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  };
  const motivosOrdenados = contar(naoFechou.map((r) => r.motivo_perda ?? ""));
  const perguntasPerdidasOrdenadas = contar(
    naoFechou.flatMap((r) => (Array.isArray(r.perguntas_principais) ? (r.perguntas_principais as string[]) : [])),
  );

  const perguntasRecentes = resumos
    .flatMap((r) =>
      Array.isArray(r.perguntas_principais)
        ? (r.perguntas_principais as string[]).map((p) => ({ pergunta: p, resumoId: r.conversation_id }))
        : [],
    )
    .slice(0, 10);

  return (
    <div>
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
            Passaram para a equipe
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

      <div className="mt-4 grid gap-3.5 md:grid-cols-2">
        <div className="card px-5 py-5">
          <p className="mb-4 text-[14px] font-bold">Como os clientes se sentem</p>
          {comSentimento === 0 ? (
            <p className="text-[12.5px] text-ink-faint">Aparece a partir das próximas conversas resumidas.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {(["positivo", "neutro", "negativo"] as Sentimento[]).map((k) => {
                const pct = Math.round((porSentimento[k] / comSentimento) * 100);
                return (
                  <div key={k}>
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="font-semibold">{SENTIMENTO_LABEL[k]}</span>
                      <span className="text-ink-faint">{pct}%</span>
                    </div>
                    <div className="h-[9px] w-full overflow-hidden rounded-full bg-surface-soft">
                      <div
                        className={`h-full rounded-full ${k === "positivo" ? "bg-teal" : k === "negativo" ? "bg-coral" : "bg-purple"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card px-5 py-5">
          <p className="mb-1 text-[14px] font-bold">Onde os clientes desistem</p>
          <p className="mb-3 text-[12.5px] text-ink-faint">Motivo provável e perguntas das conversas que não fecharam.</p>
          {motivosOrdenados.length === 0 && perguntasPerdidasOrdenadas.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">Sem casos de perda nesse período.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {motivosOrdenados.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {motivosOrdenados.map(([m, q]) => (
                    <li key={m} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="font-semibold first-letter:uppercase">{m}</span>
                      <span className="shrink-0 text-ink-faint">{q}x</span>
                    </li>
                  ))}
                </ul>
              )}
              {perguntasPerdidasOrdenadas.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Perguntavam sobre</p>
                  <ul className="flex flex-col gap-1.5">
                    {perguntasPerdidasOrdenadas.map(([p, q]) => (
                      <li key={p} className="flex items-center justify-between gap-3 text-[12.5px] text-ink-soft">
                        <span className="first-letter:uppercase">{p}</span>
                        <span className="shrink-0 text-ink-faint">{q}x</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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
                    <p className="truncate text-[12px] text-ink-faint">
                      {r.interesse ? "🔥".repeat(r.interesse) + " " : ""}
                      {r.motivo_perda ? r.motivo_perda + ". " : ""}
                      {r.resumo}
                    </p>
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

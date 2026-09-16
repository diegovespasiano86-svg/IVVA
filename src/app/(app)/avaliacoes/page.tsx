import { createClient } from "@/lib/supabase/server";
import { LineAreaChart, CardVazio } from "@/components/charts";

function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill={i < nota ? "#FF6B5B" : "none"}
          stroke={i < nota ? "#FF6B5B" : "var(--border)"}
          strokeWidth="1.8"
        >
          <path d="M12 2.5l2.9 6.9 7.1.6-5.4 4.7 1.6 7-6.2-4-6.2 4 1.6-7L2 10l7.1-.6L12 2.5Z" />
        </svg>
      ))}
    </span>
  );
}

const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export default async function AvaliacoesPage() {
  const supabase = await createClient();

  const inicio6meses = new Date();
  inicio6meses.setMonth(inicio6meses.getMonth() - 5);
  inicio6meses.setDate(1);
  inicio6meses.setHours(0, 0, 0, 0);

  const [{ data: avaliacoes }, { count: solicitadas }] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, nota, comentario, canal, created_at, contacts(nome)")
      .order("created_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .not("last_review_request_at", "is", null),
  ]);

  const total = avaliacoes?.length ?? 0;
  const media = total
    ? (avaliacoes!.reduce((soma, a) => soma + a.nota, 0) / total)
    : 0;
  const promotores = total
    ? Math.round(
        (avaliacoes!.filter((a) => a.nota >= 4).length / total) * 100,
      )
    : 0;
  const taxaResposta =
    solicitadas && solicitadas > 0 ? Math.round((total / solicitadas) * 100) : null;

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const avaliacoesMes = (avaliacoes ?? []).filter(
    (a) => new Date(a.created_at) >= inicioMes,
  ).length;

  const distribuicao = [5, 4, 3, 2, 1].map((nota) => ({
    nota,
    count: (avaliacoes ?? []).filter((a) => a.nota === nota).length,
  }));

  // Nota média por mês — últimos 6 meses.
  const porMes = new Map<string, { soma: number; count: number }>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(inicio6meses);
    d.setMonth(d.getMonth() + i);
    porMes.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, {
      soma: 0,
      count: 0,
    });
  }
  for (const a of avaliacoes ?? []) {
    const d = new Date(a.created_at);
    if (d < inicio6meses) continue;
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const atual = porMes.get(chave);
    if (atual) {
      atual.soma += a.nota;
      atual.count += 1;
    }
  }
  const pontosNota = [...porMes.entries()].map(([chave, v]) => {
    const [, mes] = chave.split("-");
    return {
      rotulo: MESES_ABREV[Number(mes) - 1],
      valor: v.count ? Number((v.soma / v.count).toFixed(1)) : 0,
    };
  });

  // Comparativo por canal.
  const porCanal = new Map<string, { soma: number; count: number }>();
  for (const a of avaliacoes ?? []) {
    const atual = porCanal.get(a.canal) ?? { soma: 0, count: 0 };
    atual.soma += a.nota;
    atual.count += 1;
    porCanal.set(a.canal, atual);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold">
          Avaliações
        </h1>
        <p className="text-[13.5px] text-ink-soft">
          Coletadas automaticamente pelo WhatsApp após o atendimento.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Nota média
          </p>
          <p className="font-display text-[26px] font-extrabold">
            {media.toFixed(1)}
          </p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Taxa de resposta
          </p>
          <p className="font-display text-[26px] font-extrabold text-purple">
            {taxaResposta === null ? "—" : `${taxaResposta}%`}
          </p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Avaliações (mês)
          </p>
          <p className="font-display text-[26px] font-extrabold">
            {avaliacoesMes}
          </p>
        </div>
        <div className="card px-5 py-4.5 border-purple/35">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Promotores (nota 4-5)
          </p>
          <p className="font-display text-[26px] font-extrabold text-purple">
            {promotores}%
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-3.5 lg:grid-cols-[1fr_1.3fr]">
        <div className="card px-5 py-5">
          <p className="mb-3 text-[14px] font-bold">Distribuição de notas</p>
          <div className="flex flex-col gap-2">
            {distribuicao.map((d) => (
              <div key={d.nota} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-[12.5px] font-semibold text-ink-soft">
                  {d.nota} ★
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-soft">
                  <div
                    className="h-full rounded-full bg-coral"
                    style={{
                      width: total ? `${(d.count / total) * 100}%` : "0%",
                    }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-[12.5px] text-ink-faint">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card px-5 py-5">
          <p className="mb-0.5 text-[14px] font-bold">Nota média por mês</p>
          <p className="mb-3 text-[12px] text-ink-faint">Últimos 6 meses</p>
          <LineAreaChart pontos={pontosNota} cor="#FF6B5B" />
        </div>
      </div>

      <div className="card mb-4 px-5 py-5">
        <p className="mb-0.5 text-[14px] font-bold">Comparativo por canal</p>
        <p className="mb-4 text-[12px] text-ink-faint">
          Cada canal em que o cliente deixou a nota.
        </p>
        {porCanal.size === 0 ? (
          <CardVazio texto="Nenhuma avaliação por canal ainda." />
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-3">
            {[...porCanal.entries()]
              .sort((a, b) => b[1].count - a[1].count)
              .map(([canal, v]) => (
                <div
                  key={canal}
                  className="rounded-[12px] border border-border px-4 py-4"
                >
                  <p className="mb-2 text-[13px] font-bold capitalize">
                    {canal}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-[22px] font-extrabold">
                      {(v.soma / v.count).toFixed(1)}
                    </span>
                    <Estrelas nota={Math.round(v.soma / v.count)} />
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink-faint">
                    {v.count} avaliaç{v.count === 1 ? "ão" : "ões"}
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
          Nenhuma avaliação recebida ainda.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {avaliacoes!.map((a) => {
            const contato = a.contacts as unknown as { nome: string } | null;
            return (
              <div key={a.id} className="card px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-bold">
                    {contato?.nome ?? "Cliente"}
                  </span>
                  <Estrelas nota={a.nota} />
                </div>
                {a.comentario && (
                  <p className="mt-1.5 text-[13px] text-ink-soft">
                    &ldquo;{a.comentario}&rdquo;
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-ink-faint capitalize">
                  via {a.canal}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

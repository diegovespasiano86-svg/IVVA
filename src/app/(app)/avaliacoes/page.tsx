import { createClient } from "@/lib/supabase/server";

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

export default async function AvaliacoesPage() {
  const supabase = await createClient();

  const { data: avaliacoes } = await supabase
    .from("reviews")
    .select("id, nota, comentario, canal, created_at, contacts(nome)")
    .order("created_at", { ascending: false });

  const total = avaliacoes?.length ?? 0;
  const media = total
    ? (avaliacoes!.reduce((soma, a) => soma + a.nota, 0) / total)
    : 0;
  const promotores = total
    ? Math.round(
        (avaliacoes!.filter((a) => a.nota >= 4).length / total) * 100,
      )
    : 0;

  const distribuicao = [5, 4, 3, 2, 1].map((nota) => ({
    nota,
    count: (avaliacoes ?? []).filter((a) => a.nota === nota).length,
  }));

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
            Total de avaliações
          </p>
          <p className="font-display text-[26px] font-extrabold">{total}</p>
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

      <div className="mb-4 card px-5 py-5">
        <p className="mb-3 text-[14px] font-bold">Distribuição</p>
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

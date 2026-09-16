import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatarRelativo(data: string) {
  const diffMs = Date.now() - new Date(data).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffHoras = Math.round(diffMin / 60);
  if (diffHoras < 24) return `${diffHoras}h`;
  const diffDias = Math.round(diffHoras / 24);
  return `${diffDias}d`;
}

export default async function SacPage() {
  const supabase = await createClient();

  const inicio14dias = new Date();
  inicio14dias.setDate(inicio14dias.getDate() - 14);

  const { data: tickets } = await supabase
    .from("conversations")
    .select("id, status, updated_at, handoff_motivo, contacts(nome)")
    .not("handoff_motivo", "is", null)
    .gte("updated_at", inicio14dias.toISOString())
    .order("updated_at", { ascending: false })
    .limit(100);

  const ids = (tickets ?? []).map((t) => t.id);
  const { data: respostasHumano } = ids.length
    ? await supabase
        .from("messages")
        .select("conversation_id")
        .eq("remetente", "humano")
        .in("conversation_id", ids)
    : { data: [] as { conversation_id: string }[] };
  const comResposta = new Set((respostasHumano ?? []).map((m) => m.conversation_id));

  const abertos = (tickets ?? []).filter(
    (t) => t.status === "humano" && !comResposta.has(t.id),
  );
  const andamento = (tickets ?? []).filter(
    (t) => t.status === "humano" && comResposta.has(t.id),
  );
  const resolvidos = (tickets ?? []).filter((t) => t.status === "encerrada");

  const colunas: {
    titulo: string;
    cor: string;
    itens: typeof abertos;
  }[] = [
    { titulo: "Abertos", cor: "bg-coral", itens: abertos },
    { titulo: "Em andamento", cor: "bg-purple", itens: andamento },
    { titulo: "Resolvidos (14 dias)", cor: "bg-teal", itens: resolvidos },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold">
          Central de SAC
        </h1>
        <p className="text-[13.5px] text-ink-soft">
          Quando a ivva precisa de um humano, o ticket já chega com o
          histórico da conversa anexado.
        </p>
      </div>

      {(tickets ?? []).length === 0 ? (
        <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
          Nenhum encaminhamento pra humano nos últimos 14 dias. Quando o
          robô não souber responder ou o cliente pedir uma pessoa, aparece
          aqui.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {colunas.map((col) => (
            <div key={col.titulo}>
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.cor}`} />
                <span className="text-[12.5px] font-bold text-ink-soft">
                  {col.titulo}
                </span>
                <span className="text-[12px] font-semibold text-ink-faint">
                  · {col.itens.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {col.itens.length === 0 ? (
                  <p className="rounded-[10px] bg-surface-soft px-3.5 py-6 text-center text-[12px] text-ink-faint">
                    Nada por aqui.
                  </p>
                ) : (
                  col.itens.map((t) => {
                    const contato = t.contacts as unknown as {
                      nome: string;
                    } | null;
                    return (
                      <Link
                        key={t.id}
                        href={`/conversas/${t.id}`}
                        className={`card block px-4 py-3.5 hover:border-ink/25 ${
                          col.titulo === "Resolvidos (14 dias)" ? "opacity-60" : ""
                        }`}
                      >
                        <p className="mb-1 truncate text-[13px] font-bold">
                          {t.handoff_motivo}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-ink-soft">
                            {contato?.nome ?? "Cliente"}
                          </span>
                          <span className="text-[11px] text-ink-faint">
                            {formatarRelativo(t.updated_at)}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

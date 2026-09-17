import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ConversasDashboard from "./dashboard";

const STATUS_LABEL: Record<string, string> = {
  bot: "Com o robô",
  humano: "Com atendente",
  encerrada: "Encerrada",
};

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

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; periodo?: string }>;
}) {
  const { view, periodo } = await searchParams;
  const aba = view === "dashboard" ? "dashboard" : "lista";

  const supabase = await createClient();

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold">
          Conversas
        </h1>
        <p className="text-[13.5px] text-ink-soft">
          Um clique em qualquer cliente mostra o histórico completo — pra
          você acompanhar ou assumir quando precisar.
        </p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        <Link
          href="/conversas"
          className={`px-3.5 py-2 text-[13px] font-bold ${
            aba === "lista" ? "border-b-2 border-ink text-ink" : "text-ink-faint"
          }`}
        >
          Lista
        </Link>
        <Link
          href="/conversas?view=dashboard"
          className={`px-3.5 py-2 text-[13px] font-bold ${
            aba === "dashboard" ? "border-b-2 border-ink text-ink" : "text-ink-faint"
          }`}
        >
          Dashboard
        </Link>
      </div>

      {aba === "dashboard" ? (
        <ConversasDashboard periodo={periodo === "dia" || periodo === "mes" ? periodo : "semana"} />
      ) : (
        <ConversasLista supabase={supabase} />
      )}
    </div>
  );
}

async function ConversasLista({
  supabase,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const { data: conversas } = await supabase
    .from("conversations")
    .select(
      "id, status, created_at, updated_at, handoff_motivo, contacts(nome, telefone)",
    )
    .order("updated_at", { ascending: false })
    .limit(60);

  const ultimasMensagens = await Promise.all(
    (conversas ?? []).map(async (c) => {
      const { data } = await supabase
        .from("messages")
        .select("conteudo, remetente, created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { id: c.id, ultima: data };
    }),
  );
  const ultimaPorConversa = new Map(
    ultimasMensagens.map((u) => [u.id, u.ultima]),
  );

  if (!conversas || conversas.length === 0) {
    return (
      <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
        Nenhuma conversa ainda. Assim que o WhatsApp estiver conectado,
        elas aparecem aqui em tempo real.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {conversas.map((c) => {
        const contato = c.contacts as unknown as {
          nome: string;
          telefone: string;
        } | null;
        const ultima = ultimaPorConversa.get(c.id);
        const prefixo =
          ultima?.remetente === "contato"
            ? ""
            : ultima?.remetente === "humano"
              ? "Você: "
              : "ivva: ";
        return (
          <Link
            key={c.id}
            href={`/conversas/${c.id}`}
            className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-0 hover:bg-surface-soft"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple/10 text-[12.5px] font-bold text-purple">
              {(contato?.nome ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-bold">
                  {contato?.nome ?? "Contato"}
                </span>
                {c.handoff_motivo && c.status !== "encerrada" && (
                  <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-bold text-coral">
                    SAC
                  </span>
                )}
              </div>
              <p className="truncate text-[12.5px] text-ink-faint">
                {ultima
                  ? `${prefixo}${ultima.conteudo}`
                  : "Sem mensagens ainda."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-[11px] text-ink-faint">
                {formatarRelativo(c.updated_at ?? c.created_at)}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                  c.status === "encerrada"
                    ? "bg-surface-soft text-ink-faint"
                    : c.status === "humano"
                      ? "bg-purple/10 text-purple"
                      : "bg-teal/10 text-teal"
                }`}
              >
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

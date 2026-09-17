import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReplyForm from "../reply-form";
import { encerrarConversa, restaurarBot } from "../actions";
import { CATEGORIA_LABEL, type CategoriaResumo } from "@/lib/resumo-conversas";

const STATUS_LABEL: Record<string, string> = {
  bot: "Com o robô",
  humano: "Com atendente",
  encerrada: "Encerrada",
};

export default async function ConversaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversa } = await supabase
    .from("conversations")
    .select("id, status, created_at, handoff_motivo, contacts(nome, telefone)")
    .eq("id", id)
    .maybeSingle();

  if (!conversa) notFound();

  const { data: mensagens } = await supabase
    .from("messages")
    .select("id, remetente, conteudo, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const { data: resumo } = await supabase
    .from("conversation_summaries")
    .select("resumo, categoria, desfecho, perguntas_principais")
    .eq("conversation_id", id)
    .maybeSingle();

  const contato = conversa.contacts as unknown as {
    nome: string;
    telefone: string;
  } | null;

  return (
    <div>
      <Link
        href="/conversas"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
      >
        <svg className="icon" viewBox="0 0 24 24" width="15" height="15">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Todas as conversas
      </Link>

      <div className="card px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="block text-[15px] font-bold">
              {contato?.nome ?? "Contato"}
            </span>
            {contato?.telefone && (
              <span className="text-[12px] text-ink-faint">
                {contato.telefone}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                conversa.status === "encerrada"
                  ? "bg-surface-soft text-ink-faint"
                  : conversa.status === "humano"
                    ? "bg-purple/10 text-purple"
                    : "bg-teal/10 text-teal"
              }`}
            >
              {STATUS_LABEL[conversa.status] ?? conversa.status}
            </span>
            {conversa.status === "humano" && (
              <form action={restaurarBot}>
                <input type="hidden" name="conversation_id" value={conversa.id} />
                <button
                  type="submit"
                  className="rounded-full border border-teal px-2.5 py-0.5 text-[11px] font-semibold text-teal hover:bg-teal/10"
                >
                  Restaurar bot
                </button>
              </form>
            )}
            {conversa.status !== "encerrada" && (
              <form action={encerrarConversa}>
                <input type="hidden" name="conversation_id" value={conversa.id} />
                <button
                  type="submit"
                  className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft hover:bg-surface-soft"
                >
                  Encerrar
                </button>
              </form>
            )}
          </div>
        </div>

        {conversa.handoff_motivo && (
          <div className="mb-3 rounded-[10px] border border-coral/30 bg-coral/5 px-3.5 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-coral">
              Motivo do encaminhamento
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-soft">
              {conversa.handoff_motivo}
            </p>
          </div>
        )}

        {resumo && (
          <div className="mb-3 rounded-[10px] border border-border bg-surface-soft px-3.5 py-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                Resumo da conversa
              </p>
              <span className="rounded-full bg-purple/10 px-2 py-0.5 text-[10.5px] font-bold text-purple">
                {CATEGORIA_LABEL[resumo.categoria as CategoriaResumo] ?? resumo.categoria}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                  resumo.desfecho === "fechou"
                    ? "bg-teal/10 text-teal"
                    : "bg-coral/10 text-coral"
                }`}
              >
                {resumo.desfecho === "fechou" ? "Fechou" : "Não fechou"}
              </span>
            </div>
            <p className="text-[12.5px] text-ink-soft">{resumo.resumo}</p>
            {Array.isArray(resumo.perguntas_principais) &&
              resumo.perguntas_principais.length > 0 && (
                <ul className="mt-2 flex flex-col gap-0.5">
                  {(resumo.perguntas_principais as string[]).map((p, i) => (
                    <li key={i} className="text-[12px] text-ink-faint">
                      • {p}
                    </li>
                  ))}
                </ul>
              )}
          </div>
        )}

        {!mensagens || mensagens.length === 0 ? (
          <p className="text-[12.5px] text-ink-faint">
            Sem mensagens ainda.
          </p>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto py-1">
            {mensagens.map((m) => (
              <div
                key={m.id}
                className={`max-w-[75%] rounded-[10px] px-3 py-2 text-[13px] ${
                  m.remetente === "contato"
                    ? "self-start bg-surface-soft"
                    : "self-end bg-ink text-white"
                }`}
              >
                {m.conteudo}
              </div>
            ))}
          </div>
        )}

        {conversa.status !== "encerrada" && contato && (
          <ReplyForm conversationId={conversa.id} telefone={contato.telefone} />
        )}
      </div>
    </div>
  );
}

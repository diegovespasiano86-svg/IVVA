import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReplyForm from "../reply-form";
import RascunhoForm from "../rascunho-form";
import { encerrarConversa, restaurarBot } from "../../actions";
import { atribuirConversa } from "../../../clientes/segmentacao-actions";
import { CATEGORIA_LABEL, SENTIMENTO_LABEL, type CategoriaResumo, type Sentimento } from "@/lib/resumo-conversas";

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
    .select("id, status, created_at, handoff_motivo, assigned_user_id, contacts(nome, telefone)")
    .eq("id", id)
    .maybeSingle();

  if (!conversa) notFound();

  const { data: equipe } = await supabase.from("users").select("id, nome").order("nome");

  const { data: mensagens } = await supabase
    .from("messages")
    .select("id, remetente, conteudo, created_at, fontes")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const { data: resumo } = await supabase
    .from("conversation_summaries")
    .select("resumo, categoria, desfecho, perguntas_principais, sentimento, interesse, motivo_perda")
    .eq("conversation_id", id)
    .maybeSingle();

  const { data: rascunho } = await supabase
    .from("conversation_rascunhos")
    .select("id, conteudo, fontes")
    .eq("conversation_id", id)
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const contato = conversa.contacts as unknown as {
    nome: string;
    telefone: string;
  } | null;

  return (
    <div>
      <Link
        href="/conversas"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink md:hidden"
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
              className={`badge ${
                conversa.status === "encerrada"
                  ? "badge-neutral"
                  : conversa.status === "humano"
                    ? "badge-danger"
                    : "badge-success"
              }`}
            >
              {STATUS_LABEL[conversa.status] ?? conversa.status}
            </span>
            {conversa.status === "humano" && (
              <form action={restaurarBot}>
                <input type="hidden" name="conversation_id" value={conversa.id} />
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
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
                  className="btn btn-ghost btn-sm"
                >
                  Encerrar
                </button>
              </form>
            )}
          </div>
        </div>

        {conversa.status !== "encerrada" && (equipe ?? []).length > 0 && (
          <form action={atribuirConversa} className="mb-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="conversation_id" value={conversa.id} />
            <label htmlFor="resp" className="!mb-0 text-[12px] font-bold text-ink-soft">Responsável</label>
            <select id="resp" name="user_id" defaultValue={conversa.assigned_user_id ?? ""} className="select !h-9 !w-auto min-w-[170px]">
              <option value="">Ninguém (fila geral)</option>
              {(equipe ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary btn-sm">Atribuir</button>
          </form>
        )}

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
              {resumo.interesse ? (
                <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10.5px] font-bold" title={`Interesse ${resumo.interesse} de 5`}>
                  {"🔥".repeat(resumo.interesse)}
                </span>
              ) : null}
              {resumo.sentimento ? (
                <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10.5px] font-bold text-ink-soft">
                  {SENTIMENTO_LABEL[resumo.sentimento as Sentimento] ?? resumo.sentimento}
                </span>
              ) : null}
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
          <div className="flex flex-col gap-2 py-1">
            {mensagens.map((m) => {
              const cliente = m.remetente === "contato";
              const robo = m.remetente === "bot";
              return (
                <div key={m.id} className={`flex max-w-[78%] flex-col ${cliente ? "items-start self-start" : "items-end self-end"}`}>
                  {!cliente && (
                    <span className="mb-0.5 px-1 text-[10.5px] font-bold text-ink-faint">{robo ? "Robô" : "Equipe"}</span>
                  )}
                  <div
                    className={`rounded-[14px] px-3.5 py-2 text-[13.5px] leading-snug whitespace-pre-wrap ${
                      cliente
                        ? "rounded-tl-sm border border-border bg-surface"
                        : robo
                          ? "rounded-tr-sm bg-[#ece9fc] text-ink"
                          : "rounded-tr-sm bg-ink-deep text-white"
                    }`}
                  >
                    {m.conteudo}
                  </div>
                  {robo && Array.isArray(m.fontes) && m.fontes.length > 0 && (
                    <details className="mt-1 max-w-full px-1 text-[11px] text-ink-faint">
                      <summary className="cursor-pointer select-none font-semibold">Fonte da resposta</summary>
                      <ul className="mt-1 flex flex-col gap-1">
                        {(m.fontes as string[]).map((f, i) => (
                          <li key={i} className="rounded-md bg-surface-soft px-2 py-1 text-ink-soft">{f}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <span className="mt-0.5 px-1 text-[10.5px] text-ink-faint">
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {rascunho && conversa.status !== "encerrada" && (
          <RascunhoForm rascunhoId={rascunho.id} texto={rascunho.conteudo} fontes={Array.isArray(rascunho.fontes) ? (rascunho.fontes as string[]) : []} />
        )}

        {conversa.status !== "encerrada" && contato && (
          <ReplyForm conversationId={conversa.id} />
        )}
      </div>
    </div>
  );
}

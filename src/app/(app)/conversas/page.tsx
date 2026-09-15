import { createClient } from "@/lib/supabase/server";
import ReplyForm from "./reply-form";
import { encerrarConversa } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  bot: "Com o robô",
  humano: "Com atendente",
  encerrada: "Encerrada",
};

export default async function ConversasPage() {
  const supabase = await createClient();

  const { data: conversas } = await supabase
    .from("conversations")
    .select("id, status, created_at, contacts(nome, telefone)")
    .order("created_at", { ascending: false })
    .limit(20);

  const conversasComMensagens = await Promise.all(
    (conversas ?? []).map(async (c) => {
      const { data: mensagens } = await supabase
        .from("messages")
        .select("id, remetente, conteudo, created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: true })
        .limit(30);
      return { ...c, mensagens: mensagens ?? [] };
    }),
  );

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold">
          Conversas
        </h1>
        <p className="text-[13.5px] text-ink-soft">
          Histórico do WhatsApp — responda aqui pra assumir manualmente.
        </p>
      </div>

      {conversasComMensagens.length === 0 ? (
        <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
          Nenhuma conversa ainda. Assim que o WhatsApp estiver conectado,
          elas aparecem aqui em tempo real.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {conversasComMensagens.map((c) => {
            const contato = c.contacts as unknown as {
              nome: string;
              telefone: string;
            } | null;
            return (
              <div key={c.id} className="card px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13.5px] font-bold">
                    {contato?.nome ?? "Contato"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        c.status === "encerrada"
                          ? "bg-surface-soft text-ink-faint"
                          : c.status === "humano"
                            ? "bg-purple/10 text-purple"
                            : "bg-teal/10 text-teal"
                      }`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    {c.status !== "encerrada" && (
                      <form action={encerrarConversa}>
                        <input
                          type="hidden"
                          name="conversation_id"
                          value={c.id}
                        />
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

                {c.mensagens.length === 0 ? (
                  <p className="text-[12.5px] text-ink-faint">
                    Sem mensagens ainda.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {c.mensagens.map((m) => (
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

                {c.status !== "encerrada" && contato && (
                  <ReplyForm
                    conversationId={c.id}
                    telefone={contato.telefone}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

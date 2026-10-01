import { createClient } from "@/lib/supabase/server";
import AutoRefresh from "@/components/auto-refresh";
import InboxShell, { type InboxItem } from "./inbox-shell";

const JANELA_MS = 24 * 60 * 60 * 1000;

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: conversas } = await supabase
    .from("conversations")
    .select("id, status, created_at, updated_at, handoff_motivo, contacts(nome, telefone)")
    .order("updated_at", { ascending: false })
    .limit(100);

  const ids = (conversas ?? []).map((c) => c.id);

  // Uma consulta só pras mensagens recentes (em vez de uma por conversa).
  const { data: msgs } = ids.length
    ? await supabase
        .from("messages")
        .select("conversation_id, remetente, conteudo, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .limit(1500)
    : { data: [] };

  const ultima = new Map<string, { conteudo: string; remetente: InboxItem["autor"]; created_at: string }>();
  const ultimaDoCliente = new Map<string, string>();
  for (const m of msgs ?? []) {
    if (!ultima.has(m.conversation_id)) {
      ultima.set(m.conversation_id, {
        conteudo: m.conteudo,
        remetente: m.remetente as InboxItem["autor"],
        created_at: m.created_at,
      });
    }
    if (m.remetente === "contato" && !ultimaDoCliente.has(m.conversation_id)) {
      ultimaDoCliente.set(m.conversation_id, m.created_at);
    }
  }

  const items: InboxItem[] = (conversas ?? []).map((c) => {
    const contato = c.contacts as unknown as { nome: string; telefone: string } | null;
    const u = ultima.get(c.id);
    const doCliente = ultimaDoCliente.get(c.id);
    return {
      id: c.id,
      nome: contato?.nome ?? "Contato",
      telefone: contato?.telefone ?? null,
      status: c.status as InboxItem["status"],
      sac: !!c.handoff_motivo,
      previa: u?.conteudo ?? null,
      autor: u?.remetente ?? null,
      quando: u?.created_at ?? c.updated_at ?? c.created_at,
      janelaAte: doCliente ? new Date(new Date(doCliente).getTime() + JANELA_MS).toISOString() : null,
    };
  });

  return (
    <>
      <AutoRefresh segundos={20} />
      <InboxShell items={items}>{children}</InboxShell>
    </>
  );
}

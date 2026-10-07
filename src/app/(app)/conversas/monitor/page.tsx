import Link from "next/link";
import PageHeader from "@/components/page-header";
import { Bot, CalendarCheck, Clock, Hand, MessageCircleReply, UserRound, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AutoRefresh from "@/components/auto-refresh";

const HORA = 60 * 60 * 1000;

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}
function quando(iso: string) {
  const d = new Date(iso);
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const dia = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return dia === hoje ? hhmm(iso) : `${dia.slice(0, 5)} ${hhmm(iso)}`;
}

function Tile({
  icon: Icon,
  label,
  valor,
  hint,
  tom = "neutral",
  href,
}: {
  icon: typeof Bot;
  label: string;
  valor: number;
  hint: string;
  tom?: "neutral" | "danger" | "success" | "warn";
  href?: string;
}) {
  const cor = { neutral: "bg-[#ece9fc] text-purple", danger: "bg-[#fdece9] text-coral", success: "bg-[#e3f4ef] text-teal", warn: "bg-[#fdf0dc] text-amber" }[tom];
  const corpo = (
    <div className="card h-full px-5 py-4 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(20,18,27,0.25)]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${cor}`}>
          <Icon size={17} />
        </span>
      </div>
      <p className="text-[30px] font-extrabold leading-none">{valor}</p>
      <p className="mt-1.5 text-[12px] text-ink-soft">{hint}</p>
    </div>
  );
  return href ? <Link href={href}>{corpo}</Link> : corpo;
}

export default async function MonitorPage() {
  const supabase = await createClient();
  const agora = new Date().getTime();
  const desde24h = new Date(agora - 24 * HORA).toISOString();

  const [
    { count: aguardando },
    { count: comRobo },
    { count: respostasRobo },
    { count: respostasHumano },
    { data: msgsCliente },
    { data: abertas },
    { data: feed },
    { data: agendamentos },
  ] = await Promise.all([
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("status", "humano"),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("status", "bot"),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("remetente", "bot").gte("created_at", desde24h),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("remetente", "humano").gte("created_at", desde24h),
    supabase
      .from("messages")
      .select("conversation_id, created_at")
      .eq("remetente", "contato")
      .gte("created_at", desde24h)
      .order("created_at", { ascending: false })
      .limit(800),
    supabase
      .from("conversations")
      .select("id, status, contacts(nome)")
      .neq("status", "encerrada")
      .limit(200),
    supabase
      .from("messages")
      .select("id, remetente, conteudo, created_at, conversation_id, conversations(contacts(nome))")
      .in("remetente", ["bot", "humano"])
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("appointments")
      .select("id, servico, data_hora, origem, created_at, contacts(nome)")
      .gte("created_at", desde24h)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  // Janela do WhatsApp (24 h desde a última mensagem do cliente) perto de fechar.
  const ultimaDoCliente = new Map<string, string>();
  for (const m of msgsCliente ?? []) if (!ultimaDoCliente.has(m.conversation_id)) ultimaDoCliente.set(m.conversation_id, m.created_at);
  const fechando = (abertas ?? [])
    .map((c) => {
      const t = ultimaDoCliente.get(c.id);
      return t ? { c, restanteMs: new Date(t).getTime() + 24 * HORA - agora } : null;
    })
    .filter((x): x is { c: NonNullable<typeof abertas>[number]; restanteMs: number } => !!x && x.restanteMs > 0 && x.restanteMs < 4 * HORA)
    .sort((a, b) => a.restanteMs - b.restanteMs);

  return (
    <div>
      <AutoRefresh segundos={20} />
      <PageHeader icon={Activity} title="Monitor do robô" subtitle="O que a IA está fazendo agora. Atualiza sozinho a cada 20 segundos." actions={<><span className="badge badge-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" /> Ao vivo
        </span></>} />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Tile icon={Hand} label="Precisam de você" valor={aguardando ?? 0} hint="Clientes esperando um atendente" tom={(aguardando ?? 0) > 0 ? "danger" : "neutral"} href="/sac" />
        <Tile icon={Bot} label="Com o robô" valor={comRobo ?? 0} hint="Conversas em andamento com a IA" tom="success" href="/conversas" />
        <Tile icon={MessageCircleReply} label="Respostas do robô" valor={respostasRobo ?? 0} hint="Nas últimas 24 horas" />
        <Tile icon={UserRound} label="Respostas da equipe" valor={respostasHumano ?? 0} hint="Nas últimas 24 horas" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <header className="border-b border-border px-5 py-3.5">
            <h2 className="text-[14px] font-extrabold">Atividade recente</h2>
            <p className="text-[12px] text-ink-soft">Últimas respostas enviadas pelo robô e pela equipe</p>
          </header>
          {(feed ?? []).length === 0 ? (
            <p className="px-5 py-12 text-center text-[13px] text-ink-faint">Ainda não há atividade. Quando o robô responder um cliente, aparece aqui.</p>
          ) : (
            <ul>
              {(feed ?? []).map((m) => {
                const nome = (m.conversations as unknown as { contacts: { nome: string } | null } | null)?.contacts?.nome ?? "Contato";
                const robo = m.remetente === "bot";
                return (
                  <li key={m.id}>
                    <Link href={`/conversas/${m.conversation_id}`} className="flex gap-3 border-b border-border px-5 py-3 last:border-0 hover:bg-surface-soft">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${robo ? "bg-[#ece9fc] text-purple" : "bg-surface-soft text-ink-soft"}`}>
                        {robo ? <Bot size={16} /> : <UserRound size={16} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px]">
                          <span className="font-bold">{robo ? "Robô" : "Equipe"}</span> respondeu <span className="font-bold">{nome}</span>
                        </p>
                        <p className="truncate text-[12.5px] text-ink-soft">{m.conteudo}</p>
                      </div>
                      <span className="shrink-0 text-[11.5px] text-ink-faint">{quando(m.created_at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="card">
            <header className="border-b border-border px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-[14px] font-extrabold">
                <Clock size={16} className="text-amber" /> Janela de 24 h fechando
              </h2>
              <p className="text-[12px] text-ink-soft">Depois dela, só dá para enviar modelos aprovados</p>
            </header>
            {fechando.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ink-faint">Nenhuma conversa perto de fechar.</p>
            ) : (
              <ul>
                {fechando.slice(0, 6).map(({ c, restanteMs }) => (
                  <li key={c.id}>
                    <Link href={`/conversas/${c.id}`} className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0 hover:bg-surface-soft">
                      <span className="truncate text-[13px] font-bold">{(c.contacts as unknown as { nome: string } | null)?.nome ?? "Contato"}</span>
                      <span className="badge badge-warn">{Math.max(1, Math.round(restanteMs / 60000))} min</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <header className="border-b border-border px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-[14px] font-extrabold">
                <CalendarCheck size={16} className="text-teal" /> Agendamentos novos (24 h)
              </h2>
            </header>
            {(agendamentos ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ink-faint">Nenhum agendamento novo nas últimas 24 horas.</p>
            ) : (
              <ul>
                {(agendamentos ?? []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold">{(a.contacts as unknown as { nome: string } | null)?.nome ?? "Cliente"}</p>
                      <p className="truncate text-[12px] text-ink-soft">{a.servico ?? "Serviço"} · {quando(a.data_hora)}</p>
                    </div>
                    <span className="badge badge-neutral shrink-0">{a.origem ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

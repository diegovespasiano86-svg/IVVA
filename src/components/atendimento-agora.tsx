import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusTile } from "@/components/charts";
import { formatarDuracao, mediana } from "@/lib/relatorios";

// Tolerância antes de contar como "sem resposta": o robô costuma responder em segundos.
const TOLERANCIA_MS = 5 * 60 * 1000;

async function carregarAtendimento() {
  const supabase = await createClient();
  const seteDias = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: abertas }, { data: recentes }] = await Promise.all([
    supabase.from("conversations").select("id, status").neq("status", "encerrada").order("updated_at", { ascending: false }).limit(150),
    supabase.from("conversations").select("id").gte("created_at", seteDias).order("created_at", { ascending: false }).limit(200),
  ]);

  const idsAbertas = (abertas ?? []).map((c) => c.id);
  const idsRecentes = (recentes ?? []).map((c) => c.id);

  const [{ data: ultimas }, { data: primeiras }] = await Promise.all([
    idsAbertas.length
      ? supabase.from("messages").select("conversation_id, remetente, created_at").in("conversation_id", idsAbertas).order("created_at", { ascending: false }).limit(3000)
      : Promise.resolve({ data: [] as { conversation_id: string; remetente: string; created_at: string }[] }),
    idsRecentes.length
      ? supabase.from("messages").select("conversation_id, remetente, created_at").in("conversation_id", idsRecentes).order("created_at", { ascending: true }).limit(6000)
      : Promise.resolve({ data: [] as { conversation_id: string; remetente: string; created_at: string }[] }),
  ]);

  // Última mensagem de cada conversa aberta: se foi do cliente, ele está esperando.
  const agora = Date.now();
  const vista = new Set<string>();
  const esperas: number[] = [];
  for (const m of ultimas ?? []) {
    if (vista.has(m.conversation_id)) continue;
    vista.add(m.conversation_id);
    if (m.remetente !== "contato") continue;
    const espera = agora - new Date(m.created_at).getTime();
    if (espera >= TOLERANCIA_MS) esperas.push(espera);
  }
  const maiorEspera = esperas.length ? Math.max(...esperas) / 1000 : null;

  // Tempo até a primeira resposta (robô ou pessoa), nas conversas dos últimos 7 dias.
  const primeiraCliente = new Map<string, number>();
  const respondida = new Set<string>();
  const tempos: number[] = [];
  for (const m of primeiras ?? []) {
    const t = new Date(m.created_at).getTime();
    if (m.remetente === "contato") {
      if (!primeiraCliente.has(m.conversation_id)) primeiraCliente.set(m.conversation_id, t);
    } else if (primeiraCliente.has(m.conversation_id) && !respondida.has(m.conversation_id)) {
      respondida.add(m.conversation_id);
      tempos.push((t - primeiraCliente.get(m.conversation_id)!) / 1000);
    }
  }
  const med = mediana(tempos);
  const comAtendente = (abertas ?? []).filter((c) => c.status === "humano").length;

  return { semResposta: esperas.length, maiorEspera, comAtendente, med, amostra: tempos.length };
}

/** Atendimento agora: quem está esperando resposta e quanto tempo o negócio leva para responder. */
export default async function AtendimentoAgora() {
  const { semResposta, maiorEspera, comAtendente, med, amostra } = await carregarAtendimento();

  return (
    <section className="card px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold">Atendimento agora</p>
          <p className="text-[12px] text-ink-soft">Quem está esperando e quanto tempo você leva para responder.</p>
        </div>
        <Link href="/conversas" className="btn btn-secondary btn-sm">
          Abrir a caixa de atendimento
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatusTile label="Sem resposta" valor={semResposta} tom={semResposta > 0 ? "critico" : "bom"} />
        <StatusTile label="Maior espera" valor={formatarDuracao(maiorEspera)} tom={maiorEspera === null ? "bom" : maiorEspera > 3600 ? "critico" : "atencao"} />
        <StatusTile label="Com atendente" valor={comAtendente} tom={comAtendente > 0 ? "atencao" : "neutro"} />
        <StatusTile label="Primeira resposta (7 dias)" valor={formatarDuracao(med)} tom="neutro" />
      </div>
      <p className="mt-3 text-[11.5px] leading-snug text-ink-soft">
        “Sem resposta” conta conversas abertas em que a última mensagem é do cliente há mais de 5 minutos. A primeira resposta é a mediana de {amostra} conversas recentes, somando robô e equipe.
      </p>
    </section>
  );
}

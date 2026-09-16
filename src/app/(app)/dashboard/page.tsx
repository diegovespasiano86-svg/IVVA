import { createClient } from "@/lib/supabase/server";
import { LineAreaChart, HBarList, VBarChart, StatusTile, CardVazio } from "@/components/charts";

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`card px-5 py-4.5 ${accent ? "border-purple/35" : ""}`}>
      <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p
        className={`font-display text-[26px] font-extrabold ${accent ? "text-purple" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function DashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const inicio14dias = new Date(now);
  inicio14dias.setDate(inicio14dias.getDate() - 13);
  inicio14dias.setHours(0, 0, 0, 0);

  const [
    { count: conversas },
    { count: contatos },
    { count: agendamentos },
    { data: pagamentos },
    { data: proximos },
    { data: conversasRecentes },
    { data: servicosData },
    { data: funnelStages },
    { data: contatosFunil },
    { count: chamadosAbertos },
    { count: aguardandoHumano },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString()),
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "agendado")
      .gte("data_hora", new Date().toISOString()),
    supabase
      .from("payments")
      .select("valor_total")
      .gte("created_at", startOfMonth.toISOString()),
    supabase
      .from("appointments")
      .select("id, data_hora, status, contacts(nome)")
      .eq("status", "agendado")
      .gte("data_hora", new Date().toISOString())
      .order("data_hora", { ascending: true })
      .limit(6),
    supabase
      .from("conversations")
      .select("created_at")
      .gte("created_at", inicio14dias.toISOString()),
    supabase
      .from("appointments")
      .select("servico")
      .neq("status", "cancelado")
      .not("servico", "is", null),
    supabase.from("funnel_stages").select("key, label, posicao").order("posicao"),
    supabase.from("contacts").select("status_funil"),
    supabase
      .from("help_requests")
      .select("*", { count: "exact", head: true })
      .neq("status", "resolvido"),
    supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("status", "humano"),
    supabase.from("reviews").select("nota"),
  ]);

  const faturamentoMes = (pagamentos ?? []).reduce(
    (soma, p) => soma + Number(p.valor_total ?? 0),
    0,
  );

  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  // Atendimentos por dia — últimos 14 dias, sempre com todos os dias
  // presentes (0 quando não teve conversa nova) pra linha não ficar
  // torta por causa de buracos.
  const porDia = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(inicio14dias);
    d.setDate(d.getDate() + i);
    porDia.set(d.toISOString().slice(0, 10), 0);
  }
  for (const c of conversasRecentes ?? []) {
    const chave = c.created_at.slice(0, 10);
    if (porDia.has(chave)) porDia.set(chave, (porDia.get(chave) ?? 0) + 1);
  }
  const pontosLinha = [...porDia.entries()].map(([data, valor]) => ({
    rotulo: new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    valor,
  }));

  // Serviços mais pedidos — top 5.
  const contagemServicos = new Map<string, number>();
  for (const a of servicosData ?? []) {
    const nome = a.servico?.trim();
    if (!nome) continue;
    contagemServicos.set(nome, (contagemServicos.get(nome) ?? 0) + 1);
  }
  const topServicos = [...contagemServicos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rotulo, valor]) => ({ rotulo, valor }));

  // Funil do CRM — na ordem configurada pelo dono, contando quantos
  // contatos estão em cada etapa agora.
  const contagemFunil = new Map<string, number>();
  for (const c of contatosFunil ?? []) {
    contagemFunil.set(c.status_funil, (contagemFunil.get(c.status_funil) ?? 0) + 1);
  }
  const etapasFunil = (funnelStages ?? []).map((f) => ({
    rotulo: f.label,
    valor: contagemFunil.get(f.key) ?? 0,
  }));

  // Atendimentos por dia da semana — média das últimas 4 semanas, pra
  // mostrar em que dia o negócio mais recebe gente.
  const inicio4semanas = new Date(now);
  inicio4semanas.setDate(inicio4semanas.getDate() - 27);
  const porDiaSemana = [0, 0, 0, 0, 0, 0, 0];
  for (const c of conversasRecentes ?? []) {
    const d = new Date(c.created_at);
    if (d >= inicio4semanas) porDiaSemana[d.getDay()]++;
  }
  const itensDiaSemana = DIAS_SEMANA.map((rotulo, i) => ({ rotulo, valor: porDiaSemana[i] }));

  const notas = (reviews ?? []).map((r) => r.nota).filter((n): n is number => n !== null);
  const mediaNotas = notas.length ? (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(1) : "—";

  return (
    <div>
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">
            Dashboard
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            Resultado do mês em linguagem de dono de negócio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <KpiCard label="Conversas este mês" value={String(conversas ?? 0)} />
        <KpiCard label="Contatos no CRM" value={String(contatos ?? 0)} />
        <KpiCard
          label="Agendamentos futuros"
          value={String(agendamentos ?? 0)}
        />
        <KpiCard
          label="Faturamento do mês"
          value={money.format(faturamentoMes)}
          accent
        />
      </div>

      <div className="mt-4 grid gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card px-5 py-5">
          <p className="mb-0.5 text-[14px] font-bold">Atendimentos por dia</p>
          <p className="mb-3 text-[12px] text-ink-faint">Últimos 14 dias · novas conversas</p>
          <LineAreaChart pontos={pontosLinha} />
        </div>

        <div className="card px-5 py-5">
          <p className="mb-0.5 text-[14px] font-bold">Serviços mais pedidos</p>
          <p className="mb-3 text-[12px] text-ink-faint">Por número de agendamentos</p>
          <HBarList itens={topServicos} />
        </div>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1fr_1.1fr]">
        <div className="card px-5 py-5">
          <p className="mb-0.5 text-[14px] font-bold">Funil do CRM</p>
          <p className="mb-3 text-[12px] text-ink-faint">Contatos por etapa agora</p>
          {etapasFunil.length === 0 ? (
            <CardVazio texto="Ainda sem etapas de funil configuradas." />
          ) : (
            <HBarList itens={etapasFunil} corDestaqueIdx={etapasFunil.length - 1} />
          )}
        </div>

        <div className="card px-5 py-5">
          <p className="mb-0.5 text-[14px] font-bold">Atendimentos por dia da semana</p>
          <p className="mb-3 text-[12px] text-ink-faint">Últimas 4 semanas</p>
          <VBarChart itens={itensDiaSemana} />
        </div>
      </div>

      <div className="mt-3.5 grid gap-3.5 md:grid-cols-3">
        <div className="card px-5 py-4.5">
          <p className="mb-3 text-[13px] font-bold">Central de atendimento</p>
          <div className="grid grid-cols-2 gap-4">
            <StatusTile
              label="Chamados abertos"
              valor={chamadosAbertos ?? 0}
              tom={(chamadosAbertos ?? 0) > 0 ? "critico" : "bom"}
            />
            <StatusTile
              label="Aguardando humano"
              valor={aguardandoHumano ?? 0}
              tom={(aguardandoHumano ?? 0) > 0 ? "atencao" : "bom"}
            />
          </div>
        </div>
        <div className="card px-5 py-4.5">
          <StatusTile label="Satisfação média" valor={mediaNotas === "—" ? "—" : `${mediaNotas} ★`} tom="neutro" />
          <p className="mt-1.5 text-[11.5px] text-ink-faint">{notas.length} avaliações recebidas</p>
        </div>
        <div className="card px-5 py-4.5">
          <StatusTile label="Faturamento do mês" valor={money.format(faturamentoMes)} tom="bom" />
          <p className="mt-1.5 text-[11.5px] text-ink-faint">Somando todos os profissionais</p>
        </div>
      </div>

      <div className="card mt-3.5 px-5 py-5">
        <p className="mb-1 text-[14px] font-bold">Próximos agendamentos</p>
        <p className="mb-4 text-[12px] text-ink-faint">
          Os 6 mais próximos, de todos os profissionais.
        </p>

        {!proximos || proximos.length === 0 ? (
          <p className="rounded-[10px] bg-surface-soft px-4 py-6 text-center text-[13px] text-ink-faint">
            Ainda sem agendamentos. Assim que o WhatsApp começar a marcar
            horários, eles aparecem aqui.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {proximos.map((ag) => (
              <li
                key={ag.id}
                className="flex items-center justify-between rounded-[10px] border border-border px-4 py-3 text-[13.5px]"
              >
                <span className="font-semibold">
                  {(ag.contacts as unknown as { nome: string } | null)
                    ?.nome ?? "Contato"}
                </span>
                <span className="text-ink-soft">
                  {new Date(ag.data_hora).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

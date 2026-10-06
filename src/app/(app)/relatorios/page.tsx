import Link from "next/link";
import { BarChart3, Bot, CalendarCheck, Clock, Download, FileSpreadsheet, MessageSquare, Sparkles, Users, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import KpiCard from "@/components/kpi-card";
import EmptyState from "@/components/empty-state";
import Barras from "@/components/barras";
import PrintButton from "@/components/print-button";
import AvaliacoesAba from "./avaliacoes-aba";
import { LineAreaChart } from "@/components/charts";
import { CATEGORIA_LABEL, type CategoriaResumo } from "@/lib/resumo-conversas";
import { PERIODOS, agrupar, brl, formatarDuracao, lerPeriodo, mediana, serieDiaria } from "@/lib/relatorios";
import { ROTULO_DATASET, TIPOS_DATASET } from "@/lib/relatorios-dados";

const ABAS = [
  { id: "geral", label: "Visão geral" },
  { id: "ia", label: "Resultado da IA" },
  { id: "atendimento", label: "Atendimento" },
  { id: "financeiro", label: "Financeiro" },
  { id: "clientes", label: "Clientes" },
  { id: "avaliacoes", label: "Avaliações" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

// Estimativa explícita: quanto tempo de atendimento humano cada resposta do robô poupa.
const MINUTOS_POR_RESPOSTA = 1;

const FORMA: Record<string, string> = { pix: "Pix", credito: "Crédito", debito: "Débito", dinheiro: "Dinheiro" };

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ aba?: string; periodo?: string }> }) {
  const sp = await searchParams;
  const aba: Aba = ABAS.some((a) => a.id === sp.aba) ? (sp.aba as Aba) : "geral";
  const periodo = lerPeriodo(sp.periodo);
  const desde = periodo.desde.toISOString();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (perfil?.role !== "dono") {
    return (
      <div>
        <PageHeader icon={BarChart3} title="Relatórios" />
        <div className="card">
          <EmptyState icon={BarChart3} title="Só o dono do negócio vê os relatórios" text="Peça ao dono para acompanhar os resultados ou exportar os dados." />
        </div>
      </div>
    );
  }

  const href = (a: string, p: string) => `/relatorios?aba=${a}&periodo=${p}`;

  return (
    <div>
      <PageHeader
        icon={BarChart3}
        title="Relatórios"
        subtitle={`${periodo.label}. Dados do seu negócio em tempo real.`}
        actions={<PrintButton />}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <nav className="tabs" aria-label="Relatórios">
          {ABAS.map((a) => (
            <Link key={a.id} href={href(a.id, periodo.chave)} className="tab" aria-selected={aba === a.id}>
              {a.label}
            </Link>
          ))}
        </nav>
        <div className="segmented" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <Link key={p.chave} href={href(aba, p.chave)} aria-selected={periodo.chave === p.chave}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {aba === "geral" && <Geral supabase={supabase} desde={desde} periodo={periodo} />}
      {aba === "ia" && <ResultadoIA supabase={supabase} desde={desde} periodo={periodo} />}
      {aba === "atendimento" && <Atendimento supabase={supabase} desde={desde} />}
      {aba === "financeiro" && <Financeiro supabase={supabase} desde={desde} periodo={periodo} />}
      {aba === "clientes" && <Clientes supabase={supabase} desde={desde} periodo={periodo} />}
      {aba === "avaliacoes" && <AvaliacoesAba supabase={supabase} desde={desde} />}

      <section className="card mt-6 px-5 py-5 print:hidden">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
          <Download size={17} className="text-purple" /> Exportar dados
        </h2>
        <p className="mb-4 text-[12.5px] text-ink-soft">
          Baixe as linhas do período selecionado ({periodo.label.toLowerCase()}) para analisar no Excel ou na sua contabilidade. Até 5.000 linhas por arquivo.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIPOS_DATASET.map((t) => (
            <div key={t} className="rounded-xl border border-border bg-bg px-4 py-3.5">
              <p className="mb-2.5 text-[13px] font-extrabold">{ROTULO_DATASET[t]}</p>
              <div className="flex gap-2">
                <a href={`/relatorios/exportar?tipo=${t}&periodo=${periodo.chave}&formato=csv`} className="btn btn-secondary btn-sm">
                  CSV
                </a>
                <a href={`/relatorios/exportar?tipo=${t}&periodo=${periodo.chave}&formato=xlsx`} className="btn btn-secondary btn-sm">
                  <FileSpreadsheet size={14} /> Excel
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type Sb = Awaited<ReturnType<typeof createClient>>;
type P = ReturnType<typeof lerPeriodo>;

function Bloco({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <section className="card px-5 py-5">
      <h2 className="text-[14px] font-extrabold">{titulo}</h2>
      {subtitulo && <p className="mb-3.5 text-[12px] text-ink-soft">{subtitulo}</p>}
      {!subtitulo && <div className="mb-3.5" />}
      {children}
    </section>
  );
}

async function Geral({ supabase, desde, periodo }: { supabase: Sb; desde: string; periodo: P }) {
  const [{ data: conversas }, { data: pagamentos }, { count: agendamentos }, { count: novos }] = await Promise.all([
    supabase.from("conversations").select("created_at, contact_id").gte("created_at", desde).limit(5000),
    supabase.from("payments").select("created_at, valor_total").gte("created_at", desde).limit(5000),
    supabase.from("appointments").select("id", { count: "exact", head: true }).gte("created_at", desde),
    supabase.from("contacts").select("id", { count: "exact", head: true }).gte("created_at", desde),
  ]);
  const fat = (pagamentos ?? []).reduce((s, p) => s + Number(p.valor_total ?? 0), 0);
  const atendidos = new Set((conversas ?? []).map((c) => c.contact_id)).size;
  const ticket = (pagamentos ?? []).length ? fat / (pagamentos ?? []).length : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <KpiCard label="Conversas" numero={(conversas ?? []).length} icon={MessageSquare} />
        <KpiCard label="Clientes atendidos" numero={atendidos} icon={Users} />
        <KpiCard label="Agendamentos criados" numero={agendamentos ?? 0} icon={CalendarCheck} />
        <KpiCard label="Faturamento" value={brl.format(fat)} icon={Wallet} accent />
        <KpiCard label="Ticket médio" value={brl.format(ticket)} icon={Wallet} />
        <KpiCard label="Novos clientes" numero={novos ?? 0} icon={Users} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Conversas por dia" subtitulo={periodo.label}>
          <LineAreaChart pontos={serieDiaria((conversas ?? []).map((c) => ({ data: c.created_at })), periodo)} />
        </Bloco>
        <Bloco titulo="Faturamento por dia" subtitulo="Pagamentos registrados no Checkout">
          <LineAreaChart cor="#8B7FE8" pontos={serieDiaria((pagamentos ?? []).map((p) => ({ data: p.created_at, valor: Number(p.valor_total ?? 0) })), periodo)} />
        </Bloco>
      </div>
    </div>
  );
}

async function ResultadoIA({ supabase, desde, periodo }: { supabase: Sb; desde: string; periodo: P }) {
  const [{ data: agIA }, { count: respostasRobo }, { data: conversas }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, created_at, servico, data_hora, status, contacts(nome)")
      .eq("origem", "ia")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("remetente", "bot").gte("created_at", desde),
    supabase.from("conversations").select("id, handoff_motivo").gte("created_at", desde).limit(5000),
  ]);

  const ids = (agIA ?? []).map((a) => a.id);
  const { data: pagamentos } = ids.length
    ? await supabase.from("payments").select("valor_total, appointment_id").in("appointment_id", ids)
    : { data: [] as { valor_total: number; appointment_id: string }[] };

  const receita = (pagamentos ?? []).reduce((s, p) => s + Number(p.valor_total ?? 0), 0);
  const totalConv = (conversas ?? []).length;
  const semHumano = (conversas ?? []).filter((c) => !c.handoff_motivo).length;
  const taxa = totalConv ? Math.round((semHumano / totalConv) * 100) : 0;
  const minutos = (respostasRobo ?? 0) * MINUTOS_POR_RESPOSTA;
  const horas = minutos / 60;

  if ((agIA ?? []).length === 0 && (respostasRobo ?? 0) === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={Sparkles}
          title="Ainda não há resultado da IA neste período"
          text="Quando o robô responder clientes e marcar horários, você verá aqui quanto ele gerou de receita e de tempo."
          action={{ href: "/robo/simulador", label: "Testar o robô" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="page-hero">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[12.5px] font-bold uppercase tracking-wider text-white/60">Quanto a IA gerou · {periodo.label.toLowerCase()}</p>
            <p className="mt-1 text-[40px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">
              <span className="text-gradient">{brl.format(receita)}</span>
            </p>
            <p className="mt-2 max-w-[520px] text-[13px] text-white/70">
              Receita de pagamentos do Checkout ligados a agendamentos que o robô marcou sozinho pelo WhatsApp.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur">
              <p className="text-[22px] font-extrabold leading-none tabular-nums text-white">{(agIA ?? []).length}</p>
              <p className="mt-1 text-[11.5px] font-semibold text-white/70">agendamentos da IA</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur">
              <p className="text-[22px] font-extrabold leading-none tabular-nums text-white">{taxa}%</p>
              <p className="mt-1 text-[11.5px] font-semibold text-white/70">sem precisar de humano</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard label="Respostas do robô" numero={respostasRobo ?? 0} icon={Bot} />
        <KpiCard label="Conversas resolvidas sem humano" numero={semHumano} icon={MessageSquare} hint={`de ${totalConv} conversas`} />
        <KpiCard label="Tempo economizado (estimado)" value={horas >= 1 ? `${horas.toFixed(1).replace(".", ",")} h` : `${Math.round(minutos)} min`} icon={Clock} hint={`Estimativa de ${MINUTOS_POR_RESPOSTA} min por resposta`} />
        <KpiCard label="Agendamentos com pagamento" numero={new Set((pagamentos ?? []).map((p) => p.appointment_id)).size} icon={Wallet} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Agendamentos feitos pela IA por dia">
          <LineAreaChart cor="#8B7FE8" pontos={serieDiaria((agIA ?? []).map((a) => ({ data: a.created_at })), periodo)} />
        </Bloco>
        <Bloco titulo="Últimos agendamentos da IA">
          {(agIA ?? []).length === 0 ? (
            <p className="rounded-xl bg-surface-soft px-4 py-8 text-center text-[12.5px] text-ink-soft">Nenhum agendamento feito pela IA neste período.</p>
          ) : (
            <ul>
              {(agIA ?? []).slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold">{(a.contacts as unknown as { nome: string } | null)?.nome ?? "Cliente"}</p>
                    <p className="truncate text-[12px] text-ink-soft">{a.servico ?? "Serviço"}</p>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold text-ink-soft">
                    {new Date(a.data_hora).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>
    </div>
  );
}

async function Atendimento({ supabase, desde }: { supabase: Sb; desde: string }) {
  const [{ data: conversas }, { data: resumos }] = await Promise.all([
    supabase.from("conversations").select("id, status, handoff_motivo, created_at").gte("created_at", desde).order("created_at", { ascending: false }).limit(1000),
    supabase.from("conversation_summaries").select("categoria, desfecho").gte("gerado_em", desde).limit(2000),
  ]);

  // Tempo da primeira resposta: amostra das 300 conversas mais recentes do período.
  const amostra = (conversas ?? []).slice(0, 300).map((c) => c.id);
  const tempos: number[] = [];
  if (amostra.length) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, remetente, created_at")
      .in("conversation_id", amostra)
      .order("created_at", { ascending: true })
      .limit(8000);
    const primeiraCliente = new Map<string, number>();
    const respondida = new Set<string>();
    for (const m of msgs ?? []) {
      const t = new Date(m.created_at).getTime();
      if (m.remetente === "contato") {
        if (!primeiraCliente.has(m.conversation_id)) primeiraCliente.set(m.conversation_id, t);
      } else if (primeiraCliente.has(m.conversation_id) && !respondida.has(m.conversation_id)) {
        respondida.add(m.conversation_id);
        tempos.push((t - primeiraCliente.get(m.conversation_id)!) / 1000);
      }
    }
  }
  const med = mediana(tempos);

  const total = (conversas ?? []).length;
  const porStatus = agrupar((conversas ?? []).map((c) => ({ bot: "Com o robô", humano: "Com atendente", encerrada: "Encerradas" } as Record<string, string>)[c.status]));
  const encaminhadas = (conversas ?? []).filter((c) => c.handoff_motivo).length;
  const porAssunto = agrupar((resumos ?? []).map((r) => CATEGORIA_LABEL[r.categoria as CategoriaResumo] ?? r.categoria));
  const fechou = (resumos ?? []).filter((r) => r.desfecho === "fechou").length;
  const taxaFecha = (resumos ?? []).length ? Math.round((fechou / (resumos ?? []).length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard label="Conversas" numero={total} icon={MessageSquare} />
        <KpiCard label="Encaminhadas a humano" numero={encaminhadas} icon={Users} hint={total ? `${Math.round((encaminhadas / total) * 100)}% das conversas` : undefined} />
        <KpiCard label="Primeira resposta (mediana)" value={formatarDuracao(med)} icon={Clock} hint={tempos.length ? `Amostra de ${tempos.length} conversas` : "Sem amostra ainda"} />
        <KpiCard label="Taxa de fechamento" value={`${taxaFecha}%`} icon={CalendarCheck} hint={`${(resumos ?? []).length} conversas resumidas`} accent />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Situação das conversas">
          <Barras itens={porStatus} />
        </Bloco>
        <Bloco titulo="Assuntos mais comuns" subtitulo="Classificados pela IA a partir do resumo de cada conversa">
          <Barras itens={porAssunto} vazio="Ainda não há conversas resumidas neste período." />
        </Bloco>
      </div>
    </div>
  );
}

async function Financeiro({ supabase, desde, periodo }: { supabase: Sb; desde: string; periodo: P }) {
  const { data: pagamentos } = await supabase
    .from("payments")
    .select("created_at, valor_total, forma_pagamento, comissao_calculada, professionals(nome)")
    .gte("created_at", desde)
    .limit(5000);
  const lista = pagamentos ?? [];
  const fat = lista.reduce((s, p) => s + Number(p.valor_total ?? 0), 0);
  const com = lista.reduce((s, p) => s + Number(p.comissao_calculada ?? 0), 0);

  const somar = (chave: (p: (typeof lista)[number]) => string) => {
    const m = new Map<string, number>();
    for (const p of lista) m.set(chave(p), (m.get(chave(p)) ?? 0) + Number(p.valor_total ?? 0));
    return [...m.entries()].map(([rotulo, valor]) => ({ rotulo, valor: Math.round(valor * 100) / 100 })).sort((a, b) => b.valor - a.valor);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard label="Faturamento" value={brl.format(fat)} icon={Wallet} accent />
        <KpiCard label="Comissões" value={brl.format(com)} icon={Users} />
        <KpiCard label="Pagamentos" numero={lista.length} icon={Wallet} />
        <KpiCard label="Ticket médio" value={brl.format(lista.length ? fat / lista.length : 0)} icon={Wallet} />
      </div>
      <Bloco titulo="Faturamento por dia" subtitulo={periodo.label}>
        <LineAreaChart cor="#8B7FE8" pontos={serieDiaria(lista.map((p) => ({ data: p.created_at, valor: Number(p.valor_total ?? 0) })), periodo)} />
      </Bloco>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Por forma de pagamento">
          <Barras itens={somar((p) => FORMA[p.forma_pagamento ?? ""] ?? (p.forma_pagamento || "Outra"))} formatar={(n) => brl.format(n)} />
        </Bloco>
        <Bloco titulo="Por profissional">
          <Barras itens={somar((p) => (p.professionals as unknown as { nome: string } | null)?.nome ?? "Sem profissional")} formatar={(n) => brl.format(n)} />
        </Bloco>
      </div>
    </div>
  );
}

async function Clientes({ supabase, desde, periodo }: { supabase: Sb; desde: string; periodo: P }) {
  const [{ data: todos }, { data: avaliacoes }] = await Promise.all([
    supabase.from("contacts").select("created_at, como_conheceu, tipo_relacionamento, aceita_mensagem_automatica").limit(5000),
    supabase.from("reviews").select("nota").gte("created_at", desde).limit(2000),
  ]);
  const base = todos ?? [];
  const novos = base.filter((c) => c.created_at >= desde);
  const optOut = base.filter((c) => c.aceita_mensagem_automatica === false).length;
  const media = (avaliacoes ?? []).length ? (avaliacoes ?? []).reduce((s, r) => s + r.nota, 0) / (avaliacoes ?? []).length : null;
  const REL: Record<string, string> = { novo: "Novo", primeiro_contato: "Primeiro contato", recorrente: "Recorrente", cliente: "Cliente" };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard label="Base de clientes" numero={base.length} icon={Users} accent />
        <KpiCard label="Novos no período" numero={novos.length} icon={Users} />
        <KpiCard label="Pediram para parar" numero={optOut} icon={MessageSquare} hint="Não recebem mensagens automáticas" />
        <KpiCard label="Nota média" value={media === null ? "—" : media.toFixed(1).replace(".", ",")} icon={Sparkles} hint={`${(avaliacoes ?? []).length} avaliações`} />
      </div>
      <Bloco titulo="Novos clientes por dia" subtitulo={periodo.label}>
        <LineAreaChart pontos={serieDiaria(novos.map((c) => ({ data: c.created_at })), periodo)} />
      </Bloco>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Como conheceram o negócio">
          <Barras itens={agrupar(base.map((c) => c.como_conheceu)).slice(0, 8)} vazio="Ainda não há dados de origem." />
        </Bloco>
        <Bloco titulo="Tipo de relacionamento">
          <Barras itens={agrupar(base.map((c) => (c.tipo_relacionamento ? REL[c.tipo_relacionamento] ?? c.tipo_relacionamento : null)))} />
        </Bloco>
      </div>
    </div>
  );
}

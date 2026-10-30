import { CalendarCheck, Clock, Coins, TrendingUp, Wallet } from "lucide-react";
import type { createClient } from "@/lib/supabase/server";
import KpiCard from "@/components/kpi-card";
import { brl, type Periodo } from "@/lib/relatorios";
import { nomePlano, precoMensal } from "@/lib/planos";

type Sb = Awaited<ReturnType<typeof createClient>>;

// Estimativa explícita (a mesma da aba "Resultado da IA"): tempo humano poupado por resposta do robô.
const MINUTOS_POR_RESPOSTA = 1;

const lerValor = (v: string | undefined, max: number) => {
  const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

/** Retorno da ivva: o que o robô trouxe de receita contra o que o negócio investiu no período. */
export default async function RetornoAba({
  supabase,
  desde,
  periodo,
  plano,
  custoExtra,
  valorHora,
}: {
  supabase: Sb;
  desde: string;
  periodo: Periodo;
  plano: string | null | undefined;
  custoExtra?: string;
  valorHora?: string;
}) {
  const [{ data: agIA }, { count: respostasRobo }, { data: todos }] = await Promise.all([
    supabase.from("appointments").select("id, status").eq("origem", "ia").gte("created_at", desde).limit(2000),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("remetente", "bot").gte("created_at", desde),
    supabase.from("payments").select("valor_total, appointment_id").gte("created_at", desde).limit(5000),
  ]);

  const idsIA = new Set((agIA ?? []).map((a) => a.id));
  const pagos = (todos ?? []).filter((p) => p.appointment_id && idsIA.has(p.appointment_id));
  const receitaIA = pagos.reduce((s, p) => s + Number(p.valor_total ?? 0), 0);
  const faturamento = (todos ?? []).reduce((s, p) => s + Number(p.valor_total ?? 0), 0);
  const ticket = (todos ?? []).length ? faturamento / (todos ?? []).length : 0;

  // Agendamentos do robô que ainda não têm pagamento lançado no Checkout (e não foram cancelados).
  const comPagamento = new Set(pagos.map((p) => p.appointment_id));
  const emAberto = (agIA ?? []).filter((a) => !comPagamento.has(a.id) && a.status !== "cancelado").length;
  const potencial = emAberto * ticket;

  const mensalidade = (precoMensal(plano) * periodo.dias) / 30;
  const extra = lerValor(custoExtra, 1_000_000);
  const investimento = mensalidade + extra;
  const roi = investimento > 0 ? ((receitaIA - investimento) / investimento) * 100 : 0;
  const porReal = investimento > 0 ? receitaIA / investimento : 0;

  const horas = ((respostasRobo ?? 0) * MINUTOS_POR_RESPOSTA) / 60;
  const hora = lerValor(valorHora, 10_000);
  const economia = horas * hora;

  const positivo = receitaIA >= investimento;
  const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  const linhas: [string, string][] = [
    ["Receita de agendamentos feitos pelo robô", brl.format(receitaIA)],
    [`Mensalidade do plano ${nomePlano(plano)} (${periodo.dias} dias)`, `− ${brl.format(mensalidade)}`],
    ["Outros custos que você informou", `− ${brl.format(extra)}`],
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="page-hero">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[12.5px] font-bold uppercase tracking-wider text-white/60">Retorno da ivva · {periodo.label.toLowerCase()}</p>
            <p className="mt-1 text-[40px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">
              <span className="text-gradient">{receitaIA > 0 ? `R$ ${num(porReal)}` : "R$ 0"}</span>
              <span className="ml-2 text-[15px] font-bold text-white/70">para cada R$ 1 investido</span>
            </p>
            <p className="mt-2 max-w-[560px] text-[13px] text-white/70">
              {receitaIA === 0
                ? "Ainda não há pagamento no Checkout ligado a um agendamento feito pelo robô neste período."
                : positivo
                  ? `O robô trouxe ${brl.format(receitaIA)} e você investiu ${brl.format(investimento)}.`
                  : `O robô trouxe ${brl.format(receitaIA)}, ainda abaixo dos ${brl.format(investimento)} investidos no período.`}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur">
              <p className="text-[22px] font-extrabold leading-none tabular-nums text-white">{receitaIA > 0 ? `${roi >= 0 ? "+" : ""}${Math.round(roi)}%` : "—"}</p>
              <p className="mt-1 text-[11.5px] font-semibold text-white/70">retorno (ROI)</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur">
              <p className="text-[22px] font-extrabold leading-none tabular-nums text-white">{(agIA ?? []).length}</p>
              <p className="mt-1 text-[11.5px] font-semibold text-white/70">agendamentos do robô</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard label="Receita trazida pelo robô" value={brl.format(receitaIA)} icon={Wallet} accent hint={`${comPagamento.size} agendamentos pagos`} />
        <KpiCard label="Investimento no período" value={brl.format(investimento)} icon={Coins} hint={extra > 0 ? "Mensalidade + outros custos" : "Mensalidade proporcional"} />
        <KpiCard label="Ainda sem pagamento lançado" value={brl.format(potencial)} icon={CalendarCheck} hint={`${emAberto} agendamentos × ticket médio (estimativa)`} />
        <KpiCard label="Parte do faturamento" value={faturamento > 0 ? `${Math.round((receitaIA / faturamento) * 100)}%` : "—"} icon={TrendingUp} hint={`de ${brl.format(faturamento)} no período`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card px-5 py-4">
          <h2 className="text-[14px] font-extrabold">Como chegamos nesse número</h2>
          <p className="mb-3.5 text-[12px] text-ink-soft">Tudo vem dos seus dados. Nada é projeção, exceto onde está escrito estimativa.</p>
          <dl className="text-[13px]">
            {linhas.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-border py-2.5">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="shrink-0 font-bold tabular-nums">{v}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="font-extrabold">Resultado</dt>
              <dd className={`shrink-0 text-[15px] font-extrabold tabular-nums ${positivo ? "text-teal" : "text-coral"}`}>{brl.format(receitaIA - investimento)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11.5px] leading-snug text-ink-soft">
            Só conta como receita o pagamento registrado no Checkout e ligado ao agendamento. A mensalidade usa o preço de tabela do plano, proporcional aos dias do período.
          </p>
        </section>

        <section className="card px-5 py-4 print:hidden">
          <h2 className="text-[14px] font-extrabold">Ajuste a conta para a sua realidade</h2>
          <p className="mb-3.5 text-[12px] text-ink-soft">Estes valores servem só para este cálculo. Eles não ficam salvos.</p>
          <form method="get" action="/relatorios" className="flex flex-col gap-3">
            <input type="hidden" name="aba" value="retorno" />
            <input type="hidden" name="periodo" value={periodo.chave} />
            <div>
              <label htmlFor="custo">Outros custos no período (R$)</label>
              <input id="custo" name="custo" inputMode="decimal" defaultValue={extra ? String(extra) : ""} placeholder="Ex.: 150 de mensagens da Meta ou anúncios" className="input" />
            </div>
            <div>
              <label htmlFor="hora">Quanto vale uma hora de atendimento (R$)</label>
              <input id="hora" name="hora" inputMode="decimal" defaultValue={hora ? String(hora) : ""} placeholder="Ex.: 25" className="input" />
            </div>
            <button type="submit" className="btn btn-secondary btn-md self-start">
              Recalcular
            </button>
          </form>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-bg px-4 py-3">
            <Clock size={17} className="mt-0.5 flex-none text-purple" />
            <p className="text-[12.5px] leading-snug text-ink-soft">
              O robô deu <strong className="text-ink">{respostasRobo ?? 0} respostas</strong>, cerca de{" "}
              <strong className="text-ink">{horas >= 1 ? `${horas.toFixed(1).replace(".", ",")} horas` : `${Math.round(horas * 60)} minutos`}</strong> de atendimento (estimativa de {MINUTOS_POR_RESPOSTA} minuto por resposta).
              {hora > 0 && (
                <>
                  {" "}
                  Pelo valor que você informou, isso equivale a <strong className="text-ink">{brl.format(economia)}</strong> em tempo da equipe.
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

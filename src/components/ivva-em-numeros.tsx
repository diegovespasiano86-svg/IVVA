import { Bot, CalendarCheck, Clock, TrendingUp } from "lucide-react";

// Preço mensal de cada plano (espelha o site e a página de planos).
const PRECO_PLANO: Record<string, number> = { essencial: 297, profissional: 447, completo: 597 };
// Estimativa transparente: minutos de atendimento humano que cada conversa resolvida pelo robô poupa.
const MINUTOS_POR_CONVERSA = 4;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// "A ivva em números": o que o robô fez no mês, em linguagem de dono. Só usa dados reais do negócio.
export default function IvvaEmNumeros({
  conversas,
  intervencoes,
  agendamentosFuturos,
  faturamento,
  plano,
  rotuloAgendamentos,
}: {
  conversas: number;
  intervencoes: number;
  agendamentosFuturos: number;
  faturamento: number;
  plano: string;
  rotuloAgendamentos: string;
}) {
  const resolvidasPeloRobo = Math.max(0, conversas - intervencoes);
  const horas = (resolvidasPeloRobo * MINUTOS_POR_CONVERSA) / 60;
  const preco = PRECO_PLANO[plano] ?? PRECO_PLANO.essencial;
  const vezes = faturamento > 0 ? faturamento / preco : 0;

  const itens = [
    { icon: Bot, rotulo: "Conversas resolvidas pelo robô", valor: String(resolvidasPeloRobo) },
    { icon: Clock, rotulo: "Tempo poupado (estimado)", valor: `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h` },
    { icon: CalendarCheck, rotulo: rotuloAgendamentos, valor: String(agendamentosFuturos) },
    { icon: TrendingUp, rotulo: "Faturamento registrado no mês", valor: brl(faturamento) },
  ];

  return (
    <section className="card mb-4 px-5 py-5" aria-label="A ivva em números">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-bold">A ivva em números neste mês</h2>
        {vezes >= 1 && (
          <p className="text-[12px] font-semibold text-teal">
            O faturamento registrado foi {vezes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× o valor do seu plano
          </p>
        )}
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {itens.map((i) => (
          <div key={i.rotulo} className="rounded-[12px] bg-surface-soft px-3.5 py-3">
            <i.icon className="h-4 w-4 text-purple" strokeWidth={1.8} aria-hidden="true" />
            <p className="mt-2 font-display text-[20px] font-extrabold leading-none">{i.valor}</p>
            <p className="mt-1 text-[11.5px] leading-snug text-ink-faint">{i.rotulo}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">
        O tempo poupado é uma estimativa de {MINUTOS_POR_CONVERSA} minutos por conversa resolvida pelo robô. Os demais números vêm do seu painel.
      </p>
    </section>
  );
}

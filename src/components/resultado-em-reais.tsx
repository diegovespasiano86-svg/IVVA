import Link from "next/link";
import { CalendarCheck, Coins, HelpCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const normaliza = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// "Resultado em R$": o que o robô marcou no mês, valorizado pelo preço do serviço no catálogo.
// É estimativa (o cliente pode faltar ou mudar o serviço), por isso as premissas ficam à vista.
export default async function ResultadoEmReais({ inicioMes }: { inicioMes: string }) {
  const supabase = await createClient();
  const [{ data: marcados }, { data: servicos }, { count: semResposta }] = await Promise.all([
    supabase
      .from("appointments")
      .select("servico, status")
      .eq("origem", "ia")
      .neq("status", "cancelado")
      .gte("created_at", inicioMes)
      .limit(2000),
    supabase.from("products").select("nome, preco").eq("tipo", "servico").eq("ativo", true).gt("preco", 0),
    supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .not("handoff_motivo", "is", null)
      .gte("handoff_em", inicioMes),
  ]);

  const precos = new Map<string, number>();
  for (const s of servicos ?? []) precos.set(normaliza(s.nome), Number(s.preco));
  const lista = [...precos.values()];
  const ticketMedio = lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : 0;

  const qtd = (marcados ?? []).length;
  let total = 0;
  let porMedia = 0;
  for (const a of marcados ?? []) {
    const p = precos.get(normaliza(a.servico));
    if (p) total += p;
    else if (ticketMedio) {
      total += ticketMedio;
      porMedia += 1;
    }
  }

  const itens = [
    { icon: CalendarCheck, rotulo: "Horários marcados pelo robô no mês", valor: String(qtd) },
    { icon: Coins, rotulo: "Valor estimado desses horários", valor: ticketMedio || total ? brl(total) : "—" },
    { icon: HelpCircle, rotulo: "Vezes em que o robô passou para você", valor: String(semResposta ?? 0) },
  ];

  return (
    <section className="card mb-4 px-5 py-5" aria-label="Resultado em reais">
      <h2 className="text-[14px] font-bold">O que o robô rendeu neste mês</h2>
      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {itens.map((i) => (
          <div key={i.rotulo} className="rounded-[12px] bg-surface-soft px-3.5 py-3">
            <i.icon className="h-4 w-4 text-teal" strokeWidth={1.8} aria-hidden="true" />
            <p className="mt-2 font-display text-[20px] font-extrabold leading-none">{i.valor}</p>
            <p className="mt-1 text-[11.5px] leading-snug text-ink-faint">{i.rotulo}</p>
          </div>
        ))}
      </div>
      {(semResposta ?? 0) > 0 && (
        <p className="mt-3 text-[12.5px]">
          Quando o robô passa a conversa para você, vale ensinar a resposta:{" "}
          <Link href="/conversas" className="font-semibold text-purple underline">ver conversas</Link>
          {" · "}
          <Link href="/base-conhecimento" className="font-semibold text-purple underline">ensinar o robô</Link>
        </p>
      )}
      <p className="mt-3 text-[11px] text-ink-faint">
        Estimativa: soma do preço cadastrado no catálogo para cada horário marcado pelo robô e não cancelado
        {porMedia > 0 ? `; em ${porMedia} deles o serviço não foi encontrado no catálogo e usamos o preço médio (${brl(ticketMedio)})` : ""}.
        Não é faturamento garantido: o cliente pode faltar ou trocar o serviço. O faturamento real está no card ao lado.
      </p>
    </section>
  );
}

import { createClient } from "@/lib/supabase/server";

const FORMA: Record<string, string> = { pix: "Pix", credito: "Crédito", debito: "Débito", dinheiro: "Dinheiro" };
const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Fechamento do dia: o que entrou por forma de pagamento, o que ainda está aguardando e o que precisa de atenção. */
export default async function FechamentoDoDia() {
  const supabase = await createClient();
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const inicio = `${hoje}T00:00:00-03:00`;

  const [{ data: pags }, { data: cobr }] = await Promise.all([
    supabase.from("payments").select("valor_total, forma_pagamento, origem").gte("created_at", inicio).neq("origem", "importado"),
    supabase.from("cobrancas").select("valor, status").gte("criada_em", inicio),
  ]);

  const porForma = new Map<string, { n: number; total: number }>();
  let total = 0;
  for (const p of pags ?? []) {
    const v = Number(p.valor_total ?? 0);
    total += v;
    const f = p.forma_pagamento ?? "outro";
    const cur = porForma.get(f) ?? { n: 0, total: 0 };
    porForma.set(f, { n: cur.n + 1, total: cur.total + v });
  }
  const aguardando = (cobr ?? []).filter((c) => c.status === "pendente");
  const semBaixa = (cobr ?? []).filter((c) => c.status === "paga_sem_registro");
  const aReceber = aguardando.reduce((s, c) => s + Number(c.valor ?? 0), 0);

  return (
    <div className="card mb-4 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] font-bold">Fechamento de hoje</p>
        <p className="text-[18px] font-extrabold text-teal">{dinheiro.format(total)}</p>
      </div>
      {porForma.size === 0 ? (
        <p className="mt-1 text-[12.5px] text-ink-faint">Nada recebido hoje ainda.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          {[...porForma.entries()].map(([f, v]) => (
            <li key={f}><b>{FORMA[f] ?? f}</b> · {v.n} {v.n === 1 ? "venda" : "vendas"} · {dinheiro.format(v.total)}</li>
          ))}
        </ul>
      )}
      {aguardando.length > 0 && (
        <p className="mt-2 text-[12.5px] text-ink-soft">Aguardando pagamento: <b>{aguardando.length}</b> {aguardando.length === 1 ? "cobrança" : "cobranças"} ({dinheiro.format(aReceber)}). Ainda não entram no total acima.</p>
      )}
      {semBaixa.length > 0 && (
        <p role="alert" className="mt-2 text-[12.5px] font-semibold text-coral">
          {semBaixa.length} {semBaixa.length === 1 ? "pagamento confirmado" : "pagamentos confirmados"} sem a venda registrada (ex.: falta de estoque). Registre manualmente abaixo para o caixa fechar certo.
        </p>
      )}
    </div>
  );
}

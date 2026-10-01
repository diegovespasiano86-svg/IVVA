/** Lista de barras horizontais com valor formatado (ex.: R$). Uma cor só: o maior vai em degradê da marca. */
export default function Barras({
  itens,
  formatar = (n) => String(n),
  vazio = "Sem dados nesse período ainda.",
}: {
  itens: { rotulo: string; valor: number }[];
  formatar?: (n: number) => string;
  vazio?: string;
}) {
  if (itens.length === 0 || itens.every((i) => i.valor === 0)) {
    return <p className="rounded-xl bg-surface-soft px-4 py-8 text-center text-[12.5px] text-ink-soft">{vazio}</p>;
  }
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((item, i) => (
        <li key={item.rotulo} className="grid grid-cols-[minmax(80px,140px)_1fr_auto] items-center gap-3">
          <span className="truncate text-[12.5px] font-semibold text-ink-soft" title={item.rotulo}>
            {item.rotulo}
          </span>
          <div className="h-3.5 overflow-hidden rounded-full bg-surface-soft">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(4, (item.valor / max) * 100)}%`,
                background: i === 0 ? "linear-gradient(90deg,#8b7fe8,#6d5be0)" : "#b9b0f0",
              }}
            />
          </div>
          <span className="min-w-[44px] text-right text-[12.5px] font-extrabold tabular-nums">{formatar(item.valor)}</span>
        </li>
      ))}
    </ul>
  );
}

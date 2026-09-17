// Componentes de gráfico do dashboard — SVG puro, sem lib externa (mesmo
// espírito do resto do projeto). Paleta categórica fixa (teal → roxo →
// coral), validada por acessibilidade (CVD) via o script do skill de
// dataviz antes de usar.
const CATEGORICAL = ["#2FBF9F", "#8B7FE8", "#FF6B5B", "#A79FB4"];

export function CardVazio({ texto }: { texto: string }) {
  return (
    <p className="rounded-[10px] bg-surface-soft px-4 py-8 text-center text-[12.5px] text-ink-faint">
      {texto}
    </p>
  );
}

// Área + linha — série temporal (ex: atendimentos por dia).
export function LineAreaChart({
  pontos,
  cor = "#2FBF9F",
}: {
  pontos: { rotulo: string; valor: number }[];
  cor?: string;
}) {
  // Uma linha reta em zero não informa nada — melhor mostrar o vazio.
  if (pontos.length === 0 || pontos.every((p) => p.valor === 0)) {
    return <CardVazio texto="Sem dados nesse período ainda." />;
  }

  const W = 640;
  const H = 170;
  const PAD = 8;
  const max = Math.max(1, ...pontos.map((p) => p.valor));
  const passoX = pontos.length > 1 ? (W - PAD * 2) / (pontos.length - 1) : 0;
  const coords = pontos.map((p, i) => ({
    x: PAD + i * passoX,
    y: H - PAD - (p.valor / max) * (H - PAD * 2 - 20),
  }));
  const linha = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${linha} L${coords[coords.length - 1].x.toFixed(1)},${H - PAD} L${coords[0].x.toFixed(1)},${H - PAD} Z`;
  const gradId = `grad-${cor.replace("#", "")}`;

  // Mostra rótulo só em pontas e no pico, pra não poluir.
  const picoIdx = pontos.reduce((mi, p, i) => (p.valor > pontos[mi].valor ? i : mi), 0);
  const rotulosIdx = new Set([0, pontos.length - 1, picoIdx]);

  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" style={{ height: 170 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border)" strokeWidth="1" />
      <path d={area} fill={`url(#${gradId})`} />
      <path d={linha} fill="none" stroke={cor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) =>
        rotulosIdx.has(i) ? (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="3.5" fill={cor} />
            <text
              x={c.x}
              y={c.y - 9}
              textAnchor={i === 0 ? "start" : i === pontos.length - 1 ? "end" : "middle"}
              fontSize="10.5"
              fontWeight="700"
              fill="var(--ink)"
            >
              {pontos[i].valor}
            </text>
          </g>
        ) : null,
      )}
      {pontos.map((p, i) =>
        i === 0 || i === pontos.length - 1 || i === Math.floor(pontos.length / 2)
          ? (
            <text
              key={i}
              x={coords[i].x}
              y={H + 14}
              textAnchor={i === 0 ? "start" : i === pontos.length - 1 ? "end" : "middle"}
              fontSize="10.5"
              fill="var(--ink-faint)"
            >
              {p.rotulo}
            </text>
          )
          : null,
      )}
    </svg>
  );
}

// Barras horizontais — ranking (serviços, funil, etc.). `destaque` pinta a
// última barra (ex: etapa de fechamento) na cor de sucesso.
export function HBarList({
  itens,
  corDestaqueIdx,
}: {
  itens: { rotulo: string; valor: number }[];
  corDestaqueIdx?: number;
}) {
  if (itens.length === 0) return <CardVazio texto="Sem dados suficientes ainda." />;
  const max = Math.max(1, ...itens.map((i) => i.valor));

  return (
    <div className="flex flex-col gap-2.5">
      {itens.map((item, i) => {
        const cor = i === corDestaqueIdx ? "#2FBF9F" : CATEGORICAL[i % CATEGORICAL.length];
        const pct = Math.max(4, (item.valor / max) * 100);
        return (
          <div key={item.rotulo} className="flex items-center gap-2.5">
            <span className="w-[104px] shrink-0 truncate text-[12px] text-ink-soft" title={item.rotulo}>
              {item.rotulo}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded-[5px] bg-surface-soft">
              <div className="h-full rounded-[5px]" style={{ width: `${pct}%`, background: cor }} />
            </div>
            <span className="w-6 shrink-0 text-right text-[12.5px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {item.valor}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Barras verticais — distribuição por categoria (ex: dia da semana).
export function VBarChart({ itens }: { itens: { rotulo: string; valor: number }[] }) {
  if (itens.length === 0) return <CardVazio texto="Sem dados suficientes ainda." />;
  const W = 520;
  const H = 150;
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const larguraBarra = (W / itens.length) * 0.62;
  const gap = W / itens.length;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
        <line x1="0" y1={H - 20} x2={W} y2={H - 20} stroke="var(--border)" strokeWidth="1" />
        {itens.map((item, i) => {
          const alturaMax = H - 20 - 14;
          const altura = Math.max(3, (item.valor / max) * alturaMax);
          const x = i * gap + (gap - larguraBarra) / 2;
          const y = H - 20 - altura;
          return (
            <g key={item.rotulo}>
              <rect x={x} y={y} width={larguraBarra} height={altura} rx="4" fill="#8B7FE8" opacity={item.valor === max ? 1 : 0.55} />
              <text x={x + larguraBarra / 2} y={y - 5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--ink)">
                {item.valor}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex" style={{ marginTop: -4 }}>
        {itens.map((item) => (
          <span key={item.rotulo} className="text-center text-[10.5px] text-ink-faint" style={{ width: `${100 / itens.length}%` }}>
            {item.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

// Ladrilho de status semântico (bom/atenção/crítico) — nunca usa a cor
// categórica, é uma paleta separada de estado.
export function StatusTile({
  label,
  valor,
  tom,
}: {
  label: string;
  valor: number | string;
  tom: "bom" | "atencao" | "critico" | "neutro";
}) {
  const cores: Record<string, string> = {
    bom: "var(--teal)",
    atencao: "#D9A441",
    critico: "var(--coral)",
    neutro: "var(--ink)",
  };
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="font-display text-[21px] font-extrabold" style={{ color: cores[tom] }}>
        {valor}
      </p>
    </div>
  );
}

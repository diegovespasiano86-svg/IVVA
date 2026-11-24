import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS, reais, type ArquivoEstudio, type PedidoEstudio } from "@/lib/estudio-ops";
import PainelEstudio from "./painel";

const PERIODOS: Record<string, { label: string; dias: number | null }> = {
  "7": { label: "7 dias", dias: 7 },
  "30": { label: "30 dias", dias: 30 },
  tudo: { label: "Tudo", dias: null },
};

export default async function AdminEstudioPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const supabase = await createClient();
  const { data: ehAdmin } = await supabase.rpc("estudio_eh_admin");
  if (!ehAdmin) redirect("/dashboard");

  const sp = await searchParams;
  const per = PERIODOS[sp.p ?? "30"] ? (sp.p ?? "30") : "30";
  const dias = PERIODOS[per].dias;
  let q = supabase.from("estudio_pedidos").select("*").order("criado_em", { ascending: false }).limit(1000);
  // eslint-disable-next-line react-hooks/purity -- componente de servidor assíncrono, roda uma vez por requisição
  if (dias) q = q.gte("criado_em", new Date(Date.now() - dias * 86400000).toISOString());
  const [{ data: pedidosData }, { data: arquivosData }] = await Promise.all([
    q,
    supabase.from("estudio_arquivos").select("*").order("criado_em", { ascending: false }).limit(2000),
  ]);
  const pedidos = (pedidosData ?? []) as PedidoEstudio[];
  const arquivos = (arquivosData ?? []) as ArquivoEstudio[];
  const enviados = arquivos.filter((x) => x.enviado_por === "cliente").slice(0, 50);
  const negocioDe: Record<string, string> = {};
  for (const p of pedidos) if (p.tenant_id && p.negocio) negocioDe[p.tenant_id] = p.negocio;

  // eslint-disable-next-line react-hooks/purity -- idem
  const agora = Date.now();
  const entregues = pedidos.filter((p) => p.entregue_em);
  const tempoMedio = entregues.length
    ? entregues.reduce((s, p) => s + (new Date(p.entregue_em!).getTime() - new Date(p.criado_em).getTime()), 0) / entregues.length / 86400000
    : null;
  const abertos = pedidos.filter((p) => !["entregue", "conversa", "proposta", "fechado", "perdido"].includes(p.etapa));
  const vencendo = abertos.filter((p) => p.prazo_em && new Date(p.prazo_em).getTime() - agora < 86400000).length;
  const conversa = pedidos.filter((p) => ["conversa", "proposta", "fechado"].includes(p.etapa)).length;
  const propostas = pedidos.filter((p) => p.etapa === "proposta");
  const fechados = pedidos.filter((p) => p.etapa === "fechado");
  const comCusto = pedidos.filter((p) => p.custo_centavos != null);
  const custoMedio = comCusto.length ? Math.round(comCusto.reduce((s, p) => s + (p.custo_centavos ?? 0), 0) / comCusto.length) : null;
  const pct = (n: number) => (pedidos.length ? Math.round((n / pedidos.length) * 100) : 0);

  const kpis = [
    { v: String(pedidos.length), l: "pedidos", s: `${pedidos.filter((p) => p.tipo === "diagnostico").length} diagnósticos` },
    { v: tempoMedio == null ? "-" : `${tempoMedio.toFixed(1).replace(".", ",")} d`, l: "tempo médio de entrega", s: `${entregues.length} entregues` },
    { v: String(vencendo), l: "prazo vencendo (24 h)", s: vencendo ? "atenção" : "tudo em dia", alerta: vencendo > 0 },
    { v: `${pct(conversa)}%`, l: "chegaram à conversa", s: `${conversa} de ${pedidos.length}` },
    { v: reais(propostas.reduce((s, p) => s + (p.valor_proposta_centavos ?? 0), 0)), l: "propostas em aberto", s: `${propostas.length} proposta${propostas.length === 1 ? "" : "s"}` },
    { v: reais(fechados.reduce((s, p) => s + (p.valor_proposta_centavos ?? 0), 0)), l: "fechado", s: `custo médio ${reais(custoMedio)}` },
  ];

  const funil = [
    ["Pedidos", pedidos.length],
    ["Relatório entregue", entregues.length],
    ["Conversa", conversa],
    ["Proposta", propostas.length + fechados.length],
    ["Fechado", fechados.length],
  ] as const;

  const origens = Object.entries(
    pedidos.reduce<Record<string, number>>((acc, p) => ((acc[p.origem] = (acc[p.origem] ?? 0) + 1), acc), {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen px-4 py-8 md:px-6">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[22px] font-extrabold">IVVA Estúdio · pedidos</h1>
            <p className="text-[13.5px] text-ink-soft">Quem pediu, de onde veio, em que etapa está e quanto virou de receita.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PERIODOS).map(([k, v]) => (
              <Link key={k} href={`/admin/estudio?p=${k}`} className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${per === k ? "border-ink bg-ink text-white" : "border-border text-ink-soft hover:bg-surface-soft"}`}>
                {v.label}
              </Link>
            ))}
            <Link href="/admin" className="rounded-full border border-border px-3.5 py-1.5 text-[12.5px] font-bold text-ink-soft hover:bg-surface-soft">Voltar ao painel</Link>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => (
            <div key={k.l} className="card px-4 py-3.5 transition hover:-translate-y-1 hover:shadow-lg">
              <p className="font-display text-[22px] font-extrabold tabular-nums">{k.v}</p>
              <p className="text-[12px] text-ink-soft">{k.l}</p>
              <p className={`text-[11.5px] font-bold ${k.alerta ? "text-coral" : "text-teal"}`}>{k.s}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <div className="card px-5 py-4">
            <p className="mb-2 text-[14px] font-bold">Funil</p>
            <div className="space-y-2">
              {funil.map(([l, n]) => (
                <div key={l} className="grid grid-cols-[130px_1fr_40px] items-center gap-2 text-[13px]">
                  <span>{l}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-surface-soft">
                    <span className="block h-full rounded-full bg-gradient-to-r from-[#2fbf9f] to-[#a68ae8]" style={{ width: `${pedidos.length ? Math.max(2, (n / pedidos.length) * 100) : 0}%` }} />
                  </span>
                  <span className="text-right font-bold tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card px-5 py-4">
            <p className="mb-2 text-[14px] font-bold">De onde vieram</p>
            {origens.length === 0 ? (
              <p className="text-[13px] text-ink-faint">Nenhum pedido no período.</p>
            ) : (
              <div className="divide-y divide-border">
                {origens.map(([o, n]) => (
                  <div key={o} className="flex justify-between py-1.5 text-[13px]">
                    <span>{{ app: "Dentro do app", landing_publica: "Landing pública", campanha: "Campanha (link com utm)", chat: "Chat do site" }[o] ?? o}</span>
                    <b className="tabular-nums">{n}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <PainelEstudio pedidos={pedidos} arquivos={arquivos} etapas={ETAPAS.map((e) => ({ id: e.id, label: e.label }))} />

        <div className="mt-6 card px-5 py-4">
          <p className="mb-2 text-[14px] font-bold">Arquivos enviados pelos clientes</p>
          {enviados.length === 0 ? (
            <p className="text-[13px] text-ink-faint">Nenhum arquivo enviado ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {enviados.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="min-w-0 truncate"><b>{negocioDe[x.tenant_id] ?? "Negócio"}</b> · {x.nome}</span>
                  <a href={`/estudio/arquivo/${x.id}`} target="_blank" rel="noopener" className="shrink-0 font-bold text-purple underline">baixar</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

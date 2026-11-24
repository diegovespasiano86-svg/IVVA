import Link from "next/link";
import { FileText, Download, Clock } from "lucide-react";
import PageHeader from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { ETAPA_CLIENTE, dataBR, type ArquivoEstudio, type PedidoEstudio } from "@/lib/estudio-ops";

const SECOES = [
  ["Raio-x dos concorrentes", "Quem posta o quê, com que resultado."],
  ["Ganchos que funcionaram", "As frases de abertura que pararam o dedo."],
  ["Seu perfil hoje", "Nota, acertos e o que corrigir."],
  ["Plano de 30, 60 e 90 dias", "O que fazer, em que ordem."],
  ["Roteiros prontos", "Com direção de fala, pausas e entonação."],
];

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const [{ data: pedidos }, { data: arquivos }] = await Promise.all([
    supabase.from("estudio_pedidos").select("*").order("criado_em", { ascending: false }).limit(50),
    supabase.from("estudio_arquivos").select("*").eq("pasta", "relatorio").order("criado_em", { ascending: false }),
  ]);
  const lista = (pedidos ?? []) as PedidoEstudio[];
  const rels = (arquivos ?? []) as ArquivoEstudio[];
  const soltos = rels.filter((a) => !a.pedido_id || !lista.some((p) => p.id === a.pedido_id));

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader icon={FileText} title="Meus relatórios" subtitle="Seus pedidos ao Estúdio e os relatórios prontos, sempre salvos aqui." actions={<Link href="/estudio/projeto" className="btn btn-primary btn-md">Novo pedido</Link>} />

      {lista.length === 0 && soltos.length === 0 ? (
        <section className="card mb-4 px-5 py-6 text-center">
          <p className="text-[14px] font-extrabold">Nenhum pedido ainda</p>
          <p className="mt-1 text-[13px] text-ink-soft">Quando você pedir o primeiro diagnóstico, ele aparece aqui com o andamento.</p>
          <Link href="/estudio/projeto" className="btn btn-primary btn-md mt-3 inline-flex">Fazer meu projeto</Link>
        </section>
      ) : (
        <div className="mb-6 grid gap-3">
          {lista.map((p) => {
            const meus = rels.filter((a) => a.pedido_id === p.id);
            const pronto = meus.length > 0 && ["entregue", "conversa", "proposta", "fechado"].includes(p.etapa);
            return (
              <article key={p.id} className="card px-5 py-4 transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-extrabold">{p.tipo === "diagnostico" ? "Diagnóstico de concorrentes" : "Pedido de conversa e proposta"}</p>
                    <p className="text-[12.5px] text-ink-soft">
                      Pedido em {dataBR(p.criado_em)}
                      {p.instagram ? ` · ${p.instagram}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11.5px] font-extrabold ${pronto ? "bg-teal/10 text-teal" : "bg-purple/10 text-purple"}`}>{ETAPA_CLIENTE[p.etapa] ?? p.etapa}</span>
                </div>
                {!pronto && p.tipo === "diagnostico" && p.prazo_em && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-soft">
                    <Clock size={13} /> Previsão de entrega: até {new Date(p.prazo_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                )}
                {meus.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {meus.map((a) => (
                      <a key={a.id} href={`/estudio/arquivo/${a.id}`} target="_blank" rel="noopener" className="btn btn-primary btn-md inline-flex items-center gap-1.5">
                        <Download size={14} /> {a.nome}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
          {soltos.map((a) => (
            <article key={a.id} className="card flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <p className="text-[14px] font-extrabold">{a.nome}</p>
              <a href={`/estudio/arquivo/${a.id}`} target="_blank" rel="noopener" className="btn btn-secondary btn-md">Abrir</a>
            </article>
          ))}
        </div>
      )}

      <section className="card px-5 py-5">
        <p className="mb-3 text-[14px] font-extrabold">O que vem no diagnóstico</p>
        <ol className="space-y-2">
          {SECOES.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple/10 text-[12px] font-extrabold text-purple">{i + 1}</span>
              <p className="text-[13px]"><b>{t}.</b> <span className="text-ink-soft">{d}</span></p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[12px] text-ink-faint">Veja um exemplo completo em <Link href="/estudio" className="underline">Vitrine e proposta</Link>.</p>
      </section>
    </div>
  );
}

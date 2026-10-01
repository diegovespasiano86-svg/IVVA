import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, Cake, Camera, Clock, Mail, MessageCircle, MessageSquare, Phone, Star, StickyNote, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import KpiCard from "@/components/kpi-card";
import { formatarTelefone, normalizarTelefone, rotuloSegmento, calcularRfv } from "@/lib/clientes";
import { brl } from "@/lib/relatorios";
import { CATEGORIA_LABEL, type CategoriaResumo } from "@/lib/resumo-conversas";
import { adicionarNotaCliente } from "../actions";

const FORMA: Record<string, string> = { pix: "Pix", credito: "Crédito", debito: "Débito", dinheiro: "Dinheiro" };
const AGENDA: Record<string, string> = { agendado: "Agendado", concluido: "Concluído", cancelado: "Cancelado" };

type Evento = { quando: string; titulo: string; detalhe?: string; icon: "agenda" | "pagamento" | "conversa" | "avaliacao" | "nota"; href?: string };
const ICONE = { agenda: CalendarCheck, pagamento: Wallet, conversa: MessageSquare, avaliacao: Star, nota: StickyNote } as const;

export default async function ClientePerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: perfil }, { data: c }] = await Promise.all([
    supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle(),
    supabase
      .from("contacts")
      .select("id, nome, telefone, email, instagram, status_funil, created_at, data_nascimento, como_conheceu, aceita_mensagem_automatica")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!c) notFound();
  const dono = perfil?.role === "dono";

  const [{ data: pagamentos }, { data: agenda }, { data: conversas }, { data: avaliacoes }, { data: notas }, { data: etapa }] = await Promise.all([
    supabase.from("payments").select("valor_total, forma_pagamento, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("appointments").select("data_hora, status, servico, origem").eq("contact_id", id).order("data_hora", { ascending: false }).limit(100),
    supabase.from("conversations").select("id, status, created_at, handoff_motivo").eq("contact_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("reviews").select("nota, comentario, canal, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("contact_notes").select("conteudo, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("funnel_stages").select("label").eq("key", c.status_funil ?? "").maybeSingle(),
  ]);

  const convIds = (conversas ?? []).map((v) => v.id);
  const { data: resumos } = convIds.length
    ? await supabase.from("conversation_summaries").select("conversation_id, resumo, categoria, desfecho").in("conversation_id", convIds)
    : { data: [] as { conversation_id: string; resumo: string; categoria: string; desfecho: string }[] };
  const resumoPor = new Map((resumos ?? []).map((r) => [r.conversation_id, r]));

  const visitasIso = [...(pagamentos ?? []).map((p) => p.created_at), ...(agenda ?? []).filter((a) => a.status === "concluido").map((a) => a.data_hora)];
  const agora = new Date().getTime();
  const gasto12m = (pagamentos ?? []).filter((p) => agora - new Date(p.created_at).getTime() <= 365 * 86400000).reduce((s, p) => s + Number(p.valor_total ?? 0), 0);
  const rfv = calcularRfv({ criadoEm: c.created_at, visitas: visitasIso, valor12m: gasto12m, agora });
  const seg = rotuloSegmento(rfv.segmento);
  const totalGasto = (pagamentos ?? []).reduce((s, p) => s + Number(p.valor_total ?? 0), 0);
  const notaMedia = (avaliacoes ?? []).length ? (avaliacoes ?? []).reduce((s, r) => s + r.nota, 0) / (avaliacoes ?? []).length : null;
  const ultima = visitasIso.length ? visitasIso.reduce((a, b) => (a > b ? a : b)) : null;

  const linha: Evento[] = [
    ...(agenda ?? []).map((a) => ({ quando: a.data_hora, titulo: `${a.servico ?? "Agendamento"} · ${AGENDA[a.status] ?? a.status}`, detalhe: a.origem === "ia" ? "Marcado pelo robô" : undefined, icon: "agenda" as const })),
    ...(dono ? (pagamentos ?? []).map((p) => ({ quando: p.created_at, titulo: `Pagamento de ${brl.format(Number(p.valor_total ?? 0))}`, detalhe: FORMA[p.forma_pagamento ?? ""] ?? p.forma_pagamento ?? undefined, icon: "pagamento" as const })) : []),
    ...(conversas ?? []).map((v) => {
      const r = resumoPor.get(v.id);
      return { quando: v.created_at, titulo: r ? `Conversa: ${CATEGORIA_LABEL[r.categoria as CategoriaResumo] ?? r.categoria}` : "Conversa no WhatsApp", detalhe: r?.resumo ?? v.handoff_motivo ?? undefined, icon: "conversa" as const, href: `/conversas/${v.id}` };
    }),
    ...(avaliacoes ?? []).map((r) => ({ quando: r.created_at, titulo: `Avaliou com ${r.nota} ${r.nota === 1 ? "estrela" : "estrelas"}`, detalhe: r.comentario ?? undefined, icon: "avaliacao" as const })),
    ...(notas ?? []).map((n) => ({ quando: n.created_at, titulo: "Anotação da equipe", detalhe: n.conteudo, icon: "nota" as const })),
  ].sort((a, b) => (a.quando < b.quando ? 1 : -1)).slice(0, 40);

  const tel = normalizarTelefone(c.telefone);
  const nasc = c.data_nascimento ? new Date(`${c.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : null;

  return (
    <div>
      <Link href="/clientes" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={15} /> Clientes
      </Link>

      <section className="page-hero mb-5">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-[22px] font-extrabold text-white backdrop-blur">{c.nome.slice(0, 2).toUpperCase()}</span>
            <div>
              <h1 className="no-accent text-[24px] font-extrabold leading-tight text-white">{c.nome}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`badge ${seg.badge}`}>{seg.label}</span>
                {etapa?.label && <span className="badge bg-white/15 text-white">{etapa.label}</span>}
                <span className={`badge ${c.aceita_mensagem_automatica === false ? "bg-white/15 text-white" : "badge-success"}`}>{c.aceita_mensagem_automatica === false ? "Não recebe mensagens automáticas" : "Recebe mensagens automáticas"}</span>
              </div>
            </div>
          </div>
          {tel && (
            <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-md">
              <MessageCircle size={16} /> Abrir no WhatsApp
            </a>
          )}
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        {dono && <KpiCard label="Total gasto" value={brl.format(totalGasto)} icon={Wallet} accent />}
        <KpiCard label="Visitas" numero={new Set(visitasIso.map((v) => v.slice(0, 10))).size} icon={CalendarCheck} />
        <KpiCard label="Última visita" value={ultima ? new Date(ultima).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }) : "—"} icon={Clock} hint={rfv.recenciaDias !== null ? `há ${rfv.recenciaDias} dias` : undefined} />
        <KpiCard label="Nota média" value={notaMedia === null ? "—" : notaMedia.toFixed(1).replace(".", ",")} icon={Star} hint={`${(avaliacoes ?? []).length} avaliações`} />
        <KpiCard label="Conversas" numero={(conversas ?? []).length} icon={MessageSquare} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <section className="card">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-extrabold">Histórico do cliente</h2>
            <p className="text-[12.5px] text-ink-soft">Tudo o que aconteceu, do mais recente para o mais antigo.</p>
          </header>
          {linha.length === 0 ? (
            <p className="px-5 py-12 text-center text-[13px] text-ink-soft">Ainda não há histórico para este cliente.</p>
          ) : (
            <ol className="px-5 py-4">
              {linha.map((e, i) => {
                const Icon = ICONE[e.icon];
                const corpo = (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ece9fc] text-purple">
                        <Icon size={15} />
                      </span>
                      {i < linha.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                    </div>
                    <div className="min-w-0 pb-5">
                      <p className="text-[13.5px] font-bold">{e.titulo}</p>
                      {e.detalhe && <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-snug text-ink-soft">{e.detalhe}</p>}
                      <p className="mt-1 text-[11.5px] text-ink-faint">{new Date(e.quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</p>
                    </div>
                  </div>
                );
                return <li key={i}>{e.href ? <Link href={e.href} className="block rounded-lg hover:bg-surface-soft">{corpo}</Link> : corpo}</li>;
              })}
            </ol>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className="card px-5 py-5">
            <h2 className="mb-3 text-[14px] font-extrabold">Contato</h2>
            <ul className="flex flex-col gap-2.5 text-[13px]">
              <li className="flex items-center gap-2.5"><Phone size={15} className="text-ink-faint" /> {formatarTelefone(c.telefone) || "—"}</li>
              <li className="flex items-center gap-2.5"><Mail size={15} className="text-ink-faint" /> {c.email ?? "—"}</li>
              <li className="flex items-center gap-2.5"><Camera size={15} className="text-ink-faint" /> {c.instagram ? `@${c.instagram}` : "—"}</li>
              <li className="flex items-center gap-2.5"><Cake size={15} className="text-ink-faint" /> {nasc ?? "Aniversário não informado"}</li>
              {c.como_conheceu && <li className="text-[12.5px] text-ink-soft">Conheceu por: {c.como_conheceu}</li>}
            </ul>
          </section>

          <section className="card px-5 py-5">
            <h2 className="mb-1 text-[14px] font-extrabold">Perfil de compra</h2>
            <p className="mb-3 text-[12px] text-ink-soft">{seg.dica}</p>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-bg px-2 py-2.5">
                <dd className="text-[16px] font-extrabold tabular-nums">{rfv.recenciaDias ?? "—"}</dd>
                <dt className="text-[10.5px] font-semibold text-ink-soft">dias desde a última</dt>
              </div>
              <div className="rounded-xl bg-bg px-2 py-2.5">
                <dd className="text-[16px] font-extrabold tabular-nums">{rfv.frequencia}</dd>
                <dt className="text-[10.5px] font-semibold text-ink-soft">visitas em 12 meses</dt>
              </div>
              <div className="rounded-xl bg-bg px-2 py-2.5">
                <dd className="text-[16px] font-extrabold tabular-nums">{dono ? brl.format(rfv.valor).replace(/\s/g, "") : "—"}</dd>
                <dt className="text-[10.5px] font-semibold text-ink-soft">gasto em 12 meses</dt>
              </div>
            </dl>
          </section>

          <section className="card px-5 py-5">
            <h2 className="mb-3 text-[14px] font-extrabold">Anotar sobre o cliente</h2>
            <form action={adicionarNotaCliente} className="flex flex-col gap-2">
              <input type="hidden" name="contact_id" value={c.id} />
              <textarea name="conteudo" required rows={3} maxLength={2000} placeholder="Ex.: prefere horário da manhã, alérgica a amônia…" className="textarea" />
              <button type="submit" className="btn btn-primary btn-md self-start">Salvar anotação</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

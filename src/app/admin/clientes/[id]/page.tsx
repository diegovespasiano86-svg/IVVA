import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkWhatsapp } from "@/lib/rescue";
import { ETAPAS_DIAGNOSTICO, type RelatorioDiagnostico, type Respostas } from "@/lib/diagnostico";
import { anotarCliente, marcarImplantado, marcarReuniao, refazerRelatorio } from "../actions";

// Ficha do cliente para o time de implantação: relatório da IA, respostas do diagnóstico, reunião e histórico.

type Ficha = {
  tenant_id: string;
  nome: string;
  segmento: string | null;
  plano: string | null;
  criado_em: string;
  dono_nome: string | null;
  dono_email: string | null;
  telefone: string | null;
  assinatura_status: string | null;
  whatsapp_conectado: boolean;
  diagnostico: {
    respostas: Respostas;
    etapa: number;
    enviado_em: string | null;
    relatorio: RelatorioDiagnostico | null;
    relatorio_em: string | null;
    relatorio_erro: string | null;
    lido_em: string | null;
    reuniao_em: string | null;
    implantado_em: string | null;
  } | null;
  historico: { id: string; tipo: "nota" | "reuniao" | "sistema"; texto: string; autor: string | null; created_at: string }[];
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Valor para o campo datetime-local, no horário de Brasília. */
function paraCampo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

function linkAgendaGoogle(f: Ficha, inicioIso: string): string {
  const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ini = new Date(inicioIso).getTime();
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `Implantação ivva · ${f.nome}`,
    dates: `${fmt(ini)}/${fmt(ini + 30 * 60 * 1000)}`,
    details: `Reunião de implantação com ${f.dono_nome ?? ""} (${f.telefone ?? f.dono_email ?? ""}).\nFicha: https://app.ivva.app.br/admin/clientes/${f.tenant_id}`,
  });
  if (f.dono_email) p.set("add", f.dono_email);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const TIPO_ROTULO = { nota: "Anotação", reuniao: "Reunião", sistema: "Sistema" } as const;

export default async function FichaCliente(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("is_platform_admin").eq("id", user?.id ?? "").maybeSingle();
  if (!perfil?.is_platform_admin) redirect("/dashboard");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // Abrir a ficha conta como "lido": o card para de pulsar.
  await supabase.rpc("admin_cliente_marcar_lido", { p_tenant: id });
  const { data } = await supabase.rpc("admin_cliente_ficha", { p_tenant: id });
  const f = data as Ficha | null;
  if (!f) notFound();

  const d = f.diagnostico;
  const r = d?.relatorio ?? null;
  const zap = linkWhatsapp(
    f.telefone,
    r?.mensagem_whatsapp ??
      `Oi, ${(f.dono_nome ?? "").split(" ")[0]}! Aqui é o Diego, fundador da ivva. Vamos marcar 30 minutos para deixar a ivva redondinha no seu negócio?`,
  );

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <Link href="/admin/clientes" className="text-[13px] font-semibold text-ink-soft hover:text-ink">
          ← Quadro de implantação
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] font-extrabold">{f.nome}</h1>
            <p className="text-[13.5px] text-ink-soft">
              {f.dono_nome ?? "Sem dono"} · {f.dono_email ?? "sem e-mail"} · {f.telefone ?? "sem WhatsApp"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="badge badge-neutral">{f.segmento ?? "segmento?"}</span>
              <span className="badge badge-brand">Plano {f.plano ?? "?"}</span>
              <span className="badge badge-info">Assinatura: {f.assinatura_status ?? "?"}</span>
              <span className={`badge ${f.whatsapp_conectado ? "badge-success" : "badge-warn"}`}>
                WhatsApp {f.whatsapp_conectado ? "conectado" : "não conectado"}
              </span>
              {r && <span className={`badge ${r.potencial === "alto" ? "badge-success" : r.potencial === "medio" ? "badge-warn" : "badge-neutral"}`}>Potencial {r.potencial}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {zap && (
              <a href={zap} target="_blank" rel="noreferrer" className="btn btn-primary btn-md">
                Chamar no WhatsApp
              </a>
            )}
            <form action={marcarImplantado}>
              <input type="hidden" name="tenant" value={f.tenant_id} />
              <input type="hidden" name="feito" value={d?.implantado_em ? "0" : "1"} />
              <button className="btn btn-secondary btn-md">{d?.implantado_em ? "Reabrir implantação" : "Marcar como implantado"}</button>
            </form>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-5">
            {!d?.enviado_em && (
              <div className="card px-5 py-4 text-[14px] text-ink-soft">
                O cliente ainda está respondendo o diagnóstico (etapa {Math.min(d?.etapa ?? 0, 5)} de 5). O relatório aparece aqui assim que ele enviar.
              </div>
            )}
            {d?.enviado_em && !r && (
              <div className="card px-5 py-4">
                <p className="text-[14px] text-ink-soft">
                  {d.relatorio_erro ? `A IA não conseguiu montar o relatório (${d.relatorio_erro}).` : "A IA está montando o relatório. Atualize em instantes."}
                </p>
                <form action={refazerRelatorio} className="mt-3">
                  <input type="hidden" name="tenant" value={f.tenant_id} />
                  <button className="btn btn-secondary btn-sm">Gerar o relatório agora</button>
                </form>
              </div>
            )}

            {r && (
              <>
                <Bloco titulo="Resumo">
                  <p className="text-[14.5px] leading-relaxed">{r.resumo}</p>
                  <p className="mt-3 text-[13px] text-ink-soft">
                    <strong className="text-ink">Maturidade do atendimento: {r.maturidade?.nota}/10.</strong> {r.maturidade?.explicacao}
                  </p>
                </Bloco>

                <Bloco titulo="Dores e como a ivva resolve">
                  <ul className="flex flex-col gap-3">
                    {r.dores?.map((x, i) => (
                      <li key={i} className="rounded-xl bg-surface-soft px-4 py-3">
                        <p className="text-[14px] font-bold">{x.dor}</p>
                        <p className="mt-1 text-[13.5px] text-ink-soft">{x.solucao}</p>
                        <span className="badge badge-brand mt-2">{x.recurso}</span>
                      </li>
                    ))}
                  </ul>
                </Bloco>

                <Bloco titulo="Plano e oportunidades (ticket)">
                  <p className="text-[14px]">
                    <strong>Indicar: {r.plano_recomendado?.plano}.</strong> {r.plano_recomendado?.motivo}
                  </p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {r.oportunidades?.map((o, i) => (
                      <li key={i} className="text-[13.5px]">
                        <strong>{o.oferta}</strong> <span className="text-ink-soft">· {o.motivo}</span>
                      </li>
                    ))}
                  </ul>
                </Bloco>

                <Bloco titulo="Roteiro da reunião">
                  <p className="text-[14px]">
                    <strong>Abrir com:</strong> {r.roteiro_reuniao?.abrir_com}
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Lista titulo="Perguntar" itens={r.roteiro_reuniao?.perguntas} />
                    <Lista titulo="Mostrar (na ordem)" itens={r.roteiro_reuniao?.mostrar} />
                  </div>
                </Bloco>

                <Bloco titulo="Plano de implantação">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Lista titulo="Semana 1" itens={r.implantacao?.semana_1} />
                    <Lista titulo="Dias 8 a 30" itens={r.implantacao?.dias_8_30} />
                    <Lista titulo="Dias 31 a 60" itens={r.implantacao?.dias_31_60} />
                  </div>
                </Bloco>

                {r.riscos?.length > 0 && (
                  <Bloco titulo="Riscos de cancelamento">
                    <Lista itens={r.riscos} />
                  </Bloco>
                )}

                <div className="flex items-center justify-between text-[12px] text-ink-faint">
                  <span>Relatório gerado em {d?.relatorio_em ? dataHora(d.relatorio_em) : "?"} pela IA. Confira na reunião.</span>
                  <form action={refazerRelatorio}>
                    <input type="hidden" name="tenant" value={f.tenant_id} />
                    <button className="font-semibold text-purple hover:underline">Gerar de novo</button>
                  </form>
                </div>
              </>
            )}

            {d && Object.keys(d.respostas ?? {}).length > 0 && (
              <Bloco titulo="Respostas do cliente">
                <div className="flex flex-col gap-4">
                  {ETAPAS_DIAGNOSTICO.map((e) => (
                    <div key={e.titulo}>
                      <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-faint">{e.titulo}</p>
                      <dl className="grid gap-x-4 gap-y-1.5 text-[13.5px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                        {e.perguntas.map((p) => {
                          const v = d.respostas[p.id];
                          return (
                            <div key={p.id} className="contents">
                              <dt className="text-ink-soft">{p.rotulo}</dt>
                              <dd className="font-semibold">{Array.isArray(v) ? v.join(", ") : v || "—"}</dd>
                            </div>
                          );
                        })}
                        {e.prioridades && (
                          <div className="contents">
                            <dt className="text-ink-soft">Prioridades (em ordem)</dt>
                            <dd className="font-semibold">
                              {Array.isArray(d.respostas.prioridades) ? d.respostas.prioridades.map((x, i) => `${i + 1}. ${x}`).join(" · ") : "—"}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  ))}
                </div>
              </Bloco>
            )}
          </div>

          <aside className="flex flex-col gap-5">
            <Bloco titulo="Reunião de implantação">
              {d?.reuniao_em ? (
                <>
                  <p className="text-[15px] font-bold">{dataHora(d.reuniao_em)}</p>
                  <a href={linkAgendaGoogle(f, d.reuniao_em)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[13px] font-semibold text-teal hover:underline">
                    Adicionar no Google Agenda (convida o cliente)
                  </a>
                </>
              ) : (
                <p className="text-[13px] text-ink-soft">Ainda não marcada.</p>
              )}
              <form action={marcarReuniao} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="tenant" value={f.tenant_id} />
                <input type="datetime-local" name="quando" defaultValue={paraCampo(d?.reuniao_em ?? null)} className="input w-full" aria-label="Data e hora da reunião" />
                <button className="btn btn-primary btn-sm">{d?.reuniao_em ? "Remarcar" : "Marcar reunião"}</button>
              </form>
            </Bloco>

            <Bloco titulo="Histórico">
              <form action={anotarCliente} className="flex flex-col gap-2">
                <input type="hidden" name="tenant" value={f.tenant_id} />
                <textarea name="texto" rows={4} required placeholder="O que foi conversado, combinados, próximos passos…" className="input w-full" />
                <div className="flex items-center gap-2">
                  <select name="tipo" className="input flex-1" aria-label="Tipo da anotação" defaultValue="nota">
                    <option value="nota">Anotação</option>
                    <option value="reuniao">Resumo de reunião</option>
                  </select>
                  <button className="btn btn-secondary btn-sm">Salvar</button>
                </div>
              </form>
              <ol className="mt-4 flex flex-col gap-3">
                {f.historico.map((h) => (
                  <li key={h.id} className={`border-l-2 pl-3 ${h.tipo === "sistema" ? "border-border" : "border-purple"}`}>
                    <p className="text-[11.5px] font-semibold text-ink-faint">
                      {TIPO_ROTULO[h.tipo]} · {dataHora(h.created_at)}
                      {h.autor ? ` · ${h.autor}` : ""}
                    </p>
                    <p className={`whitespace-pre-wrap text-[13.5px] ${h.tipo === "sistema" ? "text-ink-soft" : ""}`}>{h.texto}</p>
                  </li>
                ))}
                {f.historico.length === 0 && <li className="text-[12.5px] text-ink-faint">Nada registrado ainda.</li>}
              </ol>
            </Bloco>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="card px-5 py-4">
      <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-faint">{titulo}</h2>
      {children}
    </section>
  );
}

function Lista({ titulo, itens }: { titulo?: string; itens?: string[] }) {
  return (
    <div>
      {titulo && <p className="mb-1.5 text-[12.5px] font-bold">{titulo}</p>}
      <ul className="flex list-disc flex-col gap-1 pl-4 text-[13.5px] text-ink-soft">
        {(itens ?? []).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

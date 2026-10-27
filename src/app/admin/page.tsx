import { redirect } from "next/navigation";
import { sinalConcorrente, type SinalConcorrente } from "@/lib/concorrentes";
import { createClient } from "@/lib/supabase/server";
import { resolverChamado } from "./actions";
import { limiteConversas } from "@/lib/planos";
import { linkWhatsapp } from "@/lib/rescue";
import RescuePainel from "./rescue-painel";

const PLANO_LABEL: Record<string, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  completo: "Completo",
};

const STATUS_LABEL: Record<string, { label: string; classe: string }> = {
  trial: { label: "Trial", classe: "bg-purple/10 text-purple" },
  ativa: { label: "Ativa", classe: "bg-teal/10 text-teal" },
  cancelada: { label: "Cancelada", classe: "bg-surface-soft text-ink-faint" },
  inadimplente: { label: "Inadimplente", classe: "bg-coral/10 text-coral" },
};

type AdminTenantRow = {
  tenant_id: string;
  nome: string;
  plano: string;
  assinatura_status: string | null;
  whatsapp_conectado: boolean;
  whatsapp_numero: string | null;
  dono_nome: string | null;
  dono_email: string | null;
  total_contatos: number;
  chamados_abertos: number;
  criado_em: string;
};

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  if (!perfil?.is_platform_admin) {
    redirect("/dashboard");
  }

  const [{ data }, { data: chamadosData }, { data: usoData }, { data: pendentesData }, { data: leadsData }, { data: origensData }, { data: leadsTodosData }, { data: pixData }] = await Promise.all([
    supabase.rpc("admin_tenants_overview"),
    supabase.rpc("admin_chamados_recentes"),
    supabase.rpc("admin_ia_uso_overview"),
    supabase
      .from("cadastros_pendentes")
      .select("email, nome_negocio, plano, status, created_at")
      .neq("status", "concluido")
      .order("created_at", { ascending: false })
      .limit(30),
    // Quem começou o cadastro e não pagou/finalizou: base para repescagem (WhatsApp, e-mail ou n8n).
    supabase
      .from("leads_cadastro")
      .select("nome, email, telefone, nome_negocio, segmento, plano, status, updated_at")
      .in("status", ["cadastro_iniciado", "pagamento_aberto"])
      .order("updated_at", { ascending: false })
      .limit(50),
    // Origem de todos os cadastros dos últimos 30 dias (para ver qual canal traz gente).
    supabase
      .from("leads_cadastro")
      .select("origem, status")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .limit(2000),
    // Base do alerta de possível concorrente (contrato, cláusula 5).
    supabase
      .from("leads_cadastro")
      .select("nome, email, nome_negocio, status, created_at")
      .gte("created_at", new Date(Date.now() - 120 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("assinaturas_pix").select("email, nome_negocio, cpf_cnpj, status, created_at").order("created_at", { ascending: false }).limit(1000),
  ]);
  const canais = new Map<string, { cadastros: number; pagos: number }>();
  for (const o of (origensData ?? []) as { origem: Record<string, string> | null; status: string }[]) {
    const nome = o.origem?.utm_source
      ? `${o.origem.utm_source}${o.origem.utm_medium ? ` / ${o.origem.utm_medium}` : ""}`
      : o.origem?.referrer ?? "direto ou sem informação";
    const c = canais.get(nome) ?? { cadastros: 0, pagos: 0 };
    c.cadastros++;
    if (o.status === "pago" || o.status === "conta_criada") c.pagos++;
    canais.set(nome, c);
  }
  const resumoCanais = [...canais.entries()].sort((a, b) => b[1].cadastros - a[1].cadastros).slice(0, 10);
  const leads = (leadsData ?? []) as { nome: string; email: string; telefone: string | null; nome_negocio: string | null; segmento: string | null; plano: string | null; status: string; updated_at: string }[];
  const pendentes = (pendentesData ?? []) as { email: string; nome_negocio: string | null; plano: string | null; status: string; created_at: string }[];
  const tenants = (data ?? []) as AdminTenantRow[];
  // Possíveis concorrentes: cadastros, assinaturas no Pix (têm CNPJ) e negócios ativos.
  type Alerta = { origem: string; quem: string; email: string; quando: string; sinal: SinalConcorrente };
  const alertas: Alerta[] = [];
  const vistos = new Set<string>();
  const avaliar = (origem: string, quem: string, email: string | null, quando: string, cpfCnpj?: string | null) => {
    const sinal = sinalConcorrente({ email, nomeNegocio: quem, cpfCnpj });
    const chave = (email ?? quem).toLowerCase();
    if (!sinal || vistos.has(chave)) return;
    vistos.add(chave);
    alertas.push({ origem, quem, email: email ?? "", quando, sinal });
  };
  for (const pix of (pixData ?? []) as { email: string; nome_negocio: string | null; cpf_cnpj: string | null; created_at: string }[])
    avaliar("Assinatura no Pix", pix.nome_negocio ?? "Sem nome", pix.email, pix.created_at, pix.cpf_cnpj);
  for (const t of tenants) avaliar("Negócio na ivva", t.nome, t.dono_email, t.criado_em);
  for (const l of (leadsTodosData ?? []) as { nome: string; email: string; nome_negocio: string | null; status: string; created_at: string }[])
    avaliar(l.status === "conta_criada" || l.status === "pago" ? "Cadastro pago" : "Cadastro não finalizado", l.nome_negocio ?? l.nome, l.email, l.created_at);
  alertas.sort((a, b) => Number(b.sinal.nivel === "alto") - Number(a.sinal.nivel === "alto") || b.quando.localeCompare(a.quando));
  // Uso de conversas da IA no mês, por negócio (limite = valor negociado ou o do plano).
  const usoPorTenant = new Map(
    (
      (usoData ?? []) as {
        tenant_id: string;
        usado_plano: number;
        usado_extra: number;
        usado_folga: number;
        bloqueios: number;
        saldo_extra: number;
        limite_override: number | null;
      }[]
    ).map((u) => [u.tenant_id, u]),
  );
  const chamados = (chamadosData ?? []) as {
    id: string;
    tenant_id: string;
    tenant_nome: string;
    assunto: string;
    mensagem: string | null;
    status: string;
    criado_em: string;
  }[];
  const leadsUpgrade = chamados.filter((c) => c.assunto.startsWith("Quer conhecer:"));

  const total = tenants.length;
  const comWhatsapp = tenants.filter((t) => t.whatsapp_conectado).length;
  const chamadosAbertos = tenants.reduce(
    (soma, t) => soma + Number(t.chamados_abertos ?? 0),
    0,
  );

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-[22px] font-extrabold">
              Painel IVVA
            </h1>
            <p className="text-[13.5px] text-ink-soft">
              Controle de todas as empresas — visão só sua.
            </p>
          </div>
          <a
            href="/dashboard"
            className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft hover:bg-surface-soft"
          >
            Voltar pro app
          </a>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3.5">
          <div className="card px-5 py-4.5">
            <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
              Empresas
            </p>
            <p className="font-display text-[26px] font-extrabold">{total}</p>
          </div>
          <div className="card px-5 py-4.5">
            <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
              Com WhatsApp conectado
            </p>
            <p className="font-display text-[26px] font-extrabold text-teal">
              {comWhatsapp}
              <span className="text-[15px] text-ink-faint">/{total}</span>
            </p>
          </div>
          <div className="card px-5 py-4.5">
            <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
              Chamados abertos
            </p>
            <p className="font-display text-[26px] font-extrabold text-coral">
              {chamadosAbertos}
            </p>
          </div>
        </div>

        {resumoCanais.length > 0 && (
          <div className="mb-6">
            <p className="mb-1 text-[14px] font-bold">De onde vêm os cadastros <span className="font-normal text-ink-faint">(últimos 30 dias)</span></p>
            <div className="card divide-y divide-border">
              {resumoCanais.map(([nome, c]) => (
                <div key={nome} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-0 truncate font-semibold">{nome}</span>
                  <span className="shrink-0 text-ink-soft">{c.cadastros} cadastro{c.cadastros === 1 ? "" : "s"} · {c.pagos} pago{c.pagos === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <RescuePainel supabase={supabase} />

        {alertas.length > 0 && (
          <div className="mb-6">
            <p className="mb-1 text-[14px] font-bold">
              Possíveis concorrentes <span className="font-normal text-ink-faint">({alertas.length})</span>
            </p>
            <p className="mb-3 text-[12px] text-ink-faint">
              Pelo contrato (cláusula 5), quem desenvolve, revende ou presta consultoria em atendimento automatizado, chatbot ou CRM só usa a ivva com autorização. Confira antes de liberar; o alerta não bloqueia ninguém sozinho. Para marcar um CNPJ ou uma marca, inclua em src/lib/concorrentes.ts.
            </p>
            <div className="flex flex-col gap-2">
              {alertas.slice(0, 30).map((a) => (
                <div key={a.origem + a.email + a.quem} className={`card flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${a.sinal.nivel === "alto" ? "border-coral/50" : "border-amber/40"}`}>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold">{a.quem}{a.email ? ` · ${a.email}` : ""}</p>
                    <p className="text-[12px] text-ink-faint">
                      {a.origem} · {new Date(a.quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {a.sinal.motivo}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${a.sinal.nivel === "alto" ? "bg-coral/10 text-coral" : "bg-amber/15 text-[#7a4a00]"}`}>
                    {a.sinal.nivel === "alto" ? "Provável concorrente" : "Conferir"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {leads.length > 0 && (
          <div className="mb-6">
            <p className="mb-1 text-[14px] font-bold">
              Cadastros não finalizados <span className="font-normal text-ink-faint">({leads.length})</span>
            </p>
            <p className="mb-3 text-[12px] text-ink-faint">
              Preencheram o cadastro e não concluíram o pagamento. Dá para chamar pelo WhatsApp ou por e-mail.
            </p>
            <div className="flex flex-col gap-2">
              {leads.map((l) => (
                <div key={l.email} className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold">{l.nome} · {l.nome_negocio ?? "sem nome de negócio"}</p>
                    <p className="text-[12px] text-ink-faint">
                      {l.email} · tipo {l.segmento ?? "?"} · plano {l.plano ?? "?"} · {new Date(l.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${l.status === "pagamento_aberto" ? "bg-purple/10 text-purple" : "bg-surface-soft text-ink-soft"}`}>
                      {l.status === "pagamento_aberto" ? "Parou no pagamento" : "Parou no cadastro"}
                    </span>
                    {linkWhatsapp(l.telefone, "") && (
                      <a
                        href={linkWhatsapp(l.telefone, `Oi, ${l.nome.split(" ")[0]}! Aqui é o Diego, da ivva. Vi que você começou o cadastro do ${l.nome_negocio ?? "seu negócio"} e parou antes de concluir. Ficou alguma dúvida? Posso te mostrar a ivva funcionando com os dados do seu negócio.`)!}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] font-bold text-teal hover:underline"
                      >
                        WhatsApp pronto
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="mb-6">
            <p className="mb-3 text-[14px] font-bold">
              Pagamentos sem negócio criado <span className="font-normal text-ink-faint">({pendentes.length})</span>
            </p>
            <div className="flex flex-col gap-2">
              {pendentes.map((p) => (
                <div key={p.email + p.created_at} className="card flex flex-wrap items-center justify-between gap-3 border-amber/40 px-4 py-3">
                  <div>
                    <p className="text-[13.5px] font-bold">{p.nome_negocio ?? "Sem nome"} · {p.email}</p>
                    <p className="text-[12px] text-ink-faint">
                      Plano {p.plano ?? "?"} · pago em {new Date(p.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${p.status === "conta_existente" ? "bg-coral/10 text-coral" : "bg-amber/15 text-[#7a4a00]"}`}>
                    {p.status === "conta_existente" ? "E-mail já tem conta" : "Cliente ainda não criou a senha"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[14px] font-bold">
              Chamados abertos{" "}
              <span className="font-normal text-ink-faint">
                ({chamados.length}
                {leadsUpgrade.length > 0 && (
                  <span className="text-purple"> · {leadsUpgrade.length} interesse em upgrade</span>
                )}
                )
              </span>
            </p>
          </div>
          {chamados.length === 0 ? (
            <div className="card px-6 py-8 text-center text-[13px] text-ink-faint">
              Nenhum chamado aberto agora.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {chamados.map((c) => {
                const upgrade = c.assunto.startsWith("Quer conhecer:");
                return (
                  <div
                    key={c.id}
                    className={`card flex items-start justify-between gap-4 px-4 py-3.5 ${
                      upgrade ? "border-purple/30 bg-purple/5" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold">
                        {upgrade && <span className="mr-1.5">💜</span>}
                        {c.assunto}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-ink-soft">
                        {c.tenant_nome}
                        {c.mensagem && (
                          <span className="text-ink-faint"> — {c.mensagem}</span>
                        )}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {new Date(c.criado_em).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <form action={resolverChamado}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-[8px] border border-border px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft hover:bg-surface-soft"
                      >
                        Marcar resolvido
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {total === 0 ? (
          <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
            Nenhuma empresa cadastrada ainda.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Dono</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3 text-right">Conversas IA (mês)</th>
                  <th className="px-4 py-3">Assinatura</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3 text-right">Contatos</th>
                  <th className="px-4 py-3 text-right">Chamados</th>
                  <th className="px-4 py-3">Desde</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => {
                  const status = STATUS_LABEL[t.assinatura_status ?? ""] ?? {
                    label: t.assinatura_status ?? "—",
                    classe: "bg-surface-soft text-ink-soft",
                  };
                  return (
                    <tr key={t.tenant_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-semibold">{t.nome}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {t.dono_nome ?? "—"}
                        {t.dono_email && (
                          <span className="block text-[11px] text-ink-faint">
                            {t.dono_email}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {PLANO_LABEL[t.plano] ?? t.plano}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-soft">
                        {(() => {
                          const u = usoPorTenant.get(t.tenant_id);
                          const limite = u?.limite_override ?? limiteConversas(t.plano);
                          const usadas = u?.usado_plano ?? 0;
                          const pct = limite > 0 ? Math.round((usadas * 100) / limite) : 100;
                          return (
                            <span className={pct >= 100 ? "font-bold text-coral" : pct >= 80 ? "font-bold text-amber" : ""}>
                              {usadas}/{limite}
                              {u && u.usado_extra + u.usado_folga > 0 && (
                                <span className="block text-[11px] font-normal text-ink-faint">
                                  +{u.usado_extra} avulso, +{u.usado_folga} folga
                                </span>
                              )}
                              {u && u.saldo_extra > 0 && (
                                <span className="block text-[11px] font-normal text-ink-faint">saldo avulso: {u.saldo_extra}</span>
                              )}
                              {u && u.bloqueios > 0 && (
                                <span className="block text-[11px] font-normal text-coral">{u.bloqueios} bloqueios</span>
                              )}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.classe}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {t.whatsapp_conectado ? (
                          <span className="text-[12.5px] font-semibold text-teal">
                            {t.whatsapp_numero ?? "Conectado"}
                          </span>
                        ) : (
                          <span className="text-[12.5px] text-ink-faint">
                            Não conectado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.total_contatos}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {Number(t.chamados_abertos) > 0 ? (
                          <span className="font-bold text-coral">
                            {t.chamados_abertos}
                          </span>
                        ) : (
                          <span className="text-ink-faint">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-faint">
                        {new Date(t.criado_em).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

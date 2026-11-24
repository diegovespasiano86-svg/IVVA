import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkWhatsapp } from "@/lib/rescue";
import AutoRefresh from "@/components/auto-refresh";

// Quadro de implantação: do lead da lista /60-dias até o cliente implantado. Card pulsando = relatório novo para ler.

type Lead = { id: string; nome: string; email: string; telefone: string | null; segmento: string | null; created_at: string; acesso_enviado_em: string | null };
type Cliente = {
  tenant_id: string;
  nome: string;
  segmento: string | null;
  plano: string | null;
  criado_em: string;
  dono_nome: string | null;
  dono_email: string | null;
  telefone: string | null;
  assinatura_status: string | null;
  enviado_em: string | null;
  etapa: number | null;
  relatorio_em: string | null;
  relatorio_erro: string | null;
  lido_em: string | null;
  reuniao_em: string | null;
  implantado_em: string | null;
  resumo: string | null;
  plano_recomendado: { plano?: string } | null;
  potencial: string | null;
  anotacoes: number;
};

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const POTENCIAL: Record<string, string> = { alto: "badge-success", medio: "badge-warn", baixo: "badge-neutral" };

export default async function QuadroImplantacao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("is_platform_admin").eq("id", user?.id ?? "").maybeSingle();
  if (!perfil?.is_platform_admin) redirect("/dashboard");

  const { data, error } = await supabase.rpc("admin_implantacao_quadro");
  const quadro = (data ?? { leads: [], clientes: [] }) as { leads: Lead[]; clientes: Cliente[] };

  const aguardando = quadro.clientes.filter((c) => !c.enviado_em && !c.implantado_em);
  const novos = quadro.clientes.filter((c) => c.enviado_em && !c.lido_em && !c.implantado_em);
  const reuniao = quadro.clientes.filter((c) => c.lido_em && !c.implantado_em);
  const implantados = quadro.clientes.filter((c) => c.implantado_em);

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6">
      <AutoRefresh segundos={60} />
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[22px] font-extrabold">Implantação de clientes</h1>
            <p className="text-[13.5px] text-ink-soft">
              Card pulsando = diagnóstico novo para ler antes da reunião. Atualiza sozinho a cada minuto.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin" className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft hover:bg-surface-soft">
              Painel IVVA
            </Link>
            <Link href="/dashboard" className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft hover:bg-surface-soft">
              Voltar pro app
            </Link>
          </div>
        </div>

        {error && (
          <p className="card mb-4 px-4 py-3 text-[13px] text-coral">
            O quadro ainda não está disponível (falta aplicar a atualização do banco 2026-11-24_diagnostico_cliente.sql).
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Coluna titulo="Na lista (sem conta)" dica="Recebeu o e-mail com o convite; ainda não cadastrou o cartão." total={quadro.leads.length}>
            {quadro.leads.map((l) => {
              const zap = linkWhatsapp(
                l.telefone,
                `Oi, ${l.nome.split(" ")[0]}! Aqui é o Diego, fundador da ivva 👋 Vi que você garantiu sua vaga nos 60 dias grátis da IVVA BLACK. Te mandei o convite por e-mail. Quer ajuda para ativar? Leva 2 minutos.`,
              );
              return (
                <div key={l.id} className="card px-3.5 py-3">
                  <p className="text-[14px] font-bold">{l.nome}</p>
                  <p className="text-[12px] text-ink-faint">
                    {l.segmento ?? "Segmento não informado"} · entrou {dataCurta(l.created_at)}
                  </p>
                  {zap && (
                    <a href={zap} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12.5px] font-semibold text-teal hover:underline">
                      Chamar no WhatsApp
                    </a>
                  )}
                </div>
              );
            })}
          </Coluna>

          <Coluna titulo="Assinou · respondendo" dica="Cadastrou o cartão; o popup do diagnóstico está aberto para ele." total={aguardando.length}>
            {aguardando.map((c) => (
              <CardCliente key={c.tenant_id} c={c} rodape={`Diagnóstico: etapa ${Math.min(c.etapa ?? 0, 5)} de 5`} />
            ))}
          </Coluna>

          <Coluna titulo="Diagnóstico novo" dica="Leia o relatório e marque a reunião." total={novos.length} destaque>
            {novos.map((c) => (
              <CardCliente
                key={c.tenant_id}
                c={c}
                pulsar={Boolean(c.relatorio_em)}
                rodape={c.relatorio_em ? "Relatório pronto para ler" : c.relatorio_erro ? "A IA falhou: abra e gere de novo" : "A IA está montando o relatório…"}
              />
            ))}
          </Coluna>

          <Coluna titulo="Reunião de implantação" dica="Relatório lido. Marque e faça a reunião." total={reuniao.length}>
            {reuniao.map((c) => (
              <CardCliente key={c.tenant_id} c={c} rodape={c.reuniao_em ? `Reunião ${dataCurta(c.reuniao_em)}` : "Marcar a reunião"} />
            ))}
          </Coluna>

          <Coluna titulo="Implantado" dica="Acompanhar nos dias 7, 30 e 50." total={implantados.length}>
            {implantados.map((c) => (
              <CardCliente key={c.tenant_id} c={c} rodape={`Implantado ${dataCurta(c.implantado_em!)}`} />
            ))}
          </Coluna>
        </div>
      </div>
    </div>
  );
}

function Coluna({ titulo, dica, total, destaque, children }: { titulo: string; dica: string; total: number; destaque?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl p-3 ${destaque ? "bg-purple/5 ring-1 ring-purple/20" : "bg-surface-soft"}`}>
      <div className="mb-3 px-1">
        <div className="flex items-center justify-between">
          <h2 className="text-[13.5px] font-extrabold">{titulo}</h2>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[12px] font-bold text-ink-soft">{total}</span>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">{dica}</p>
      </div>
      <div className="flex flex-col gap-2.5">{total === 0 ? <p className="px-1 py-4 text-center text-[12px] text-ink-faint">Nenhum por aqui.</p> : children}</div>
    </section>
  );
}

function CardCliente({ c, rodape, pulsar }: { c: Cliente; rodape: string; pulsar?: boolean }) {
  return (
    <Link
      href={`/admin/clientes/${c.tenant_id}`}
      className={`card card-lift relative block px-3.5 py-3 transition-shadow ${pulsar ? "animate-pulse ring-2 ring-coral/60" : ""}`}
    >
      {pulsar && (
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-75" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-coral" />
        </span>
      )}
      <p className="text-[14px] font-bold">{c.nome}</p>
      <p className="text-[12px] text-ink-faint">
        {c.dono_nome ?? "Sem dono"} · {c.plano ?? "sem plano"}
      </p>
      {typeof c.resumo === "string" && <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-snug text-ink-soft">{c.resumo}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {c.potencial && <span className={`badge ${POTENCIAL[c.potencial] ?? "badge-neutral"}`}>Potencial {c.potencial}</span>}
        {c.plano_recomendado?.plano && <span className="badge badge-brand">Indicar {c.plano_recomendado.plano}</span>}
        {c.anotacoes > 0 && <span className="badge badge-neutral">{c.anotacoes} anotações</span>}
      </div>
      <p className="mt-2 text-[12px] font-semibold text-purple">{rodape}</p>
    </Link>
  );
}

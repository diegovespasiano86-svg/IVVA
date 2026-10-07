import { createClient } from "@/lib/supabase/server";
import { Settings } from "lucide-react";
import PageHeader from "@/components/page-header";
import InviteForm from "./invite-form";
import ApagarConta from "./apagar-conta";
import { revogarConvite } from "./actions";
import { sincronizarPlanoTenant } from "@/lib/sincronizar-plano";
import ComprarCreditosButton from "@/components/comprar-creditos-button";
import Alert from "@/components/alert";
import {
  CONVERSAS_POR_PLANO,
  PACOTE_AVULSO,
  RESPOSTAS_POR_CONVERSA_MEDIA,
  formatarNumero,
} from "@/lib/planos";
import { estadoDoUso, obterResumoUso, reconciliarCreditos } from "@/lib/uso-ia";

// As ações desta tela falam com a Meta (conexão do WhatsApp); damos mais tempo que o padrão da Vercel.
export const maxDuration = 60;

const PLANO_LABEL: Record<string, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  completo: "Completo",
};

const PLANOS = [
  {
    key: "essencial",
    nome: "Essencial",
    preco: "R$ 297",
    destaque: false,
    beneficios: [
      `${formatarNumero(CONVERSAS_POR_PLANO.essencial)} conversas/mês com a IA`,
      "Chatbot no WhatsApp 24h (1 número)",
      "Agenda + CRM com funil de vendas",
      "Dashboard básico",
      "Base de conhecimento pronta pro seu nicho",
    ],
  },
  {
    key: "profissional",
    nome: "Profissional",
    preco: "R$ 447",
    destaque: true,
    beneficios: [
      `${formatarNumero(CONVERSAS_POR_PLANO.profissional)} conversas/mês com a IA`,
      "Tudo do Essencial",
      "Calendários múltiplos + comissão automática",
      "Central de SAC + avaliações",
      "Reengajamento e recall automático",
      "Fila de espera inteligente",
      "Controle de estoque",
      "Resposta por áudio",
      "Cliente cancela/remarca pelo chat",
    ],
  },
  {
    key: "completo",
    nome: "Completo",
    preco: "R$ 597",
    destaque: false,
    beneficios: [
      `${formatarNumero(CONVERSAS_POR_PLANO.completo)} conversas/mês com a IA`,
      "Tudo do Profissional",
      "Admin do negócio pelo WhatsApp",
      "Sinal antecipado (anti no-show)",
      "Recibo automático por WhatsApp",
      "Suporte prioritário",
    ],
  },
] as const;

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<{ bloqueado?: string; creditos?: string }>;
}) {
  const { bloqueado, creditos } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role, tenants(nome, plano)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const tenant = perfil?.tenants as unknown as {
    nome: string;
    plano: string;
  } | null;

  const isDono = perfil?.role === "dono";

  // Trocar de plano acontece no Portal de cobrança da Stripe, fora do
  // nosso controle — sem webhook configurado, essa é a hora que a gente
  // tem pra notar que mudou e atualizar o plano gravado no tenant.
  if (isDono && perfil?.tenant_id) {
    const { data: assinatura } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("tenant_id", perfil.tenant_id)
      .maybeSingle();
    const planoSincronizado = await sincronizarPlanoTenant(
      supabase,
      perfil.tenant_id,
      assinatura?.stripe_customer_id ?? null,
    );
    if (planoSincronizado && tenant) {
      tenant.plano = planoSincronizado;
    }
  }

  // Voltou do pagamento de créditos: confere na Stripe e credita antes de ler o saldo.
  const creditadas = isDono && creditos === "ok" ? await reconciliarCreditos(supabase) : 0;
  const resumoUso = isDono ? await obterResumoUso(supabase) : null;
  const estadoUso = resumoUso ? estadoDoUso(resumoUso) : null;

  const [{ data: conta }, { data: equipe }, { data: chamados }, { data: convites }] =
    await Promise.all([
      supabase
        .from("whatsapp_accounts")
        .select("display_phone_number, phone_number_id, status, connected_at")
        .maybeSingle(),
      supabase.from("users").select("nome, email, role").order("nome"),
      supabase
        .from("help_requests")
        .select("id, assunto, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      // RLS (invites_dono_all) já garante que só o dono enxerga algo aqui —
      // pra profissional a consulta sempre volta vazia.
      supabase
        .from("invites")
        .select("id, nome, email, status, created_at, role")
        .eq("status", "pendente")
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div>
      {bloqueado === "1" && (
        <div className="mb-5 rounded-[12px] border border-coral bg-coral/10 px-4 py-3.5 text-[13px] font-semibold text-coral">
          ⚠️ Não conseguimos confirmar o pagamento da sua assinatura — o
          acesso ao resto do sistema ficou pausado até resolver. Atualize
          a forma de pagamento em &ldquo;Gerenciar assinatura&rdquo;
          {isDono
            ? " abaixo."
            : ", fale com o dono do negócio pra corrigir."}
        </div>
      )}
      <PageHeader icon={Settings} title="Conta e equipe" subtitle={<>{tenant?.nome} · plano{" "} <span className="font-semibold text-ink"> {PLANO_LABEL[tenant?.plano ?? ""] ?? tenant?.plano} </span></>} />

      {isDono && creditos === "ok" && (
        <Alert tone="info">
          {creditadas > 0
            ? `Pagamento confirmado! Adicionamos ${formatarNumero(creditadas)} conversas ao seu saldo. A IA já está atendendo.`
            : "Recebemos o seu retorno do pagamento. Se o saldo ainda não aparecer, atualize a página em alguns instantes: a confirmação pode levar um minuto."}
        </Alert>
      )}
      {isDono && creditos === "cancelado" && (
        <Alert tone="warn">Pagamento cancelado. Nada foi cobrado. Quando quiser, é só comprar de novo.</Alert>
      )}

      {isDono && resumoUso && (
        <div className="card mb-4 px-5 py-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold">Conversas com a IA neste mês</p>
              <p className="text-[12.5px] text-ink-soft">
                Cada conversa reúne todas as respostas da IA para um mesmo cliente em até 24 horas (em média{" "}
                {RESPOSTAS_POR_CONVERSA_MEDIA} respostas). Renova em{" "}
                {new Date(resumoUso.renova_em).toLocaleDateString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  day: "2-digit",
                  month: "2-digit",
                })}
                .
              </p>
            </div>
            <ComprarCreditosButton />
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-surface-soft"
            role="progressbar"
            aria-valuenow={Math.min(resumoUso.percentual, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Conversas da IA usadas no mês"
          >
            <div
              className={`h-full rounded-full ${
                estadoUso === "ok" || estadoUso === "aviso80" ? "bg-teal" : estadoUso === "aviso90" ? "bg-amber" : "bg-coral"
              }`}
              style={{ width: `${Math.min(resumoUso.percentual, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[13px] font-semibold">
            {formatarNumero(resumoUso.usado_plano)} de {formatarNumero(resumoUso.limite)} conversas do plano ({Math.min(resumoUso.percentual, 100)}%)
          </p>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            {resumoUso.saldo_extra > 0
              ? `Créditos avulsos: ${formatarNumero(resumoUso.saldo_extra)} conversas (não expiram). `
              : "Créditos avulsos: nenhum. "}
            Passou do limite? Compre +{PACOTE_AVULSO.conversas} conversas por R${" "}
            {(PACOTE_AVULSO.valorCentavos / 100).toLocaleString("pt-BR")}: elas entram na hora e a IA continua
            atendendo.
          </p>
        </div>
      )}

      {isDono && (
        <div className="card mb-4 px-5 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold">Planos e assinatura</p>
              <p className="text-[12.5px] text-ink-soft">
                Preço público, sem &ldquo;fale com vendas&rdquo;.
              </p>
            </div>
            <div className="w-full sm:w-[200px]">
              <a href="/assinatura" className="btn w-full justify-center bg-ink px-4 py-2.5 text-[12.5px] text-white">Gerenciar assinatura</a>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PLANOS.map((plano) => {
              const atual = tenant?.plano === plano.key;
              return (
                <div
                  key={plano.key}
                  className={`rounded-[16px] border px-6 py-6 ${
                    plano.destaque
                      ? "border-transparent bg-ink text-white"
                      : atual
                        ? "border-2 border-ink"
                        : "border-border"
                  }`}
                >
                  {atual && (
                    <span
                      className={`text-[10.5px] font-extrabold uppercase tracking-wide ${
                        plano.destaque ? "text-white/70" : "text-ink-faint"
                      }`}
                    >
                      Plano atual
                    </span>
                  )}
                  {!atual && plano.destaque && (
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-white/70">
                      Mais escolhido
                    </span>
                  )}
                  <h3 className="mt-1.5 font-display text-[16.5px] font-bold">
                    {plano.nome}
                  </h3>
                  <p className="mt-2 mb-4">
                    <span className="font-display text-[28px] font-extrabold">
                      {plano.preco}
                    </span>
                    <span
                      className={`text-[13px] font-semibold ${
                        plano.destaque ? "text-white/60" : "text-ink-faint"
                      }`}
                    >
                      /mês
                    </span>
                  </p>
                  <ul className="flex flex-col gap-2">
                    {plano.beneficios.map((b) => (
                      <li
                        key={b}
                        className={`text-[12.5px] ${
                          plano.destaque ? "text-white/85" : "text-ink-soft"
                        }`}
                      >
                        ✓ {b}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-[12px] text-ink-faint">
            Pra trocar de plano, atualizar cartão ou Pix, use &ldquo;Gerenciar
            assinatura&rdquo; acima — abre o portal seguro da Stripe.
          </p>
          <p className="mt-1 text-center text-[12px] text-ink-faint">
            Conversas = todas as respostas da IA a um mesmo cliente em até 24 horas. Se passar do limite do mês,
            é possível comprar créditos avulsos (+{PACOTE_AVULSO.conversas} conversas por R${" "}
            {(PACOTE_AVULSO.valorCentavos / 100).toLocaleString("pt-BR")}).
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card px-5 py-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-bold">WhatsApp Business</p>
            {conta && (
              <span className="rounded-full bg-teal/10 px-2.5 py-0.5 text-[11px] font-bold text-teal">
                Conectado
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-ink-soft">
            {conta
              ? `Número conectado: ${conta.display_phone_number ?? conta.phone_number_id}.`
              : "Nenhum número conectado ainda."}{" "}
            Conectar, trocar ou desconectar o número fica em Canais; a personalidade e as automações do robô ficam em Configuração do robô.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href="/canais"
              className="flex items-center justify-between rounded-[10px] bg-surface-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
            >
              Canais: conectar o WhatsApp
              <span aria-hidden>→</span>
            </a>
            {isDono && (
              <a
                href="/robo"
                className="flex items-center justify-between rounded-[10px] bg-surface-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
              >
                Configuração do robô
                <span aria-hidden>→</span>
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card px-5 py-5">
            <p className="mb-3 text-[14px] font-bold">Equipe</p>
            <div className="flex flex-col gap-2">
              {(equipe ?? []).map((u) => (
                <div
                  key={u.email}
                  className="flex items-center justify-between rounded-[10px] border border-border px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-[13px] font-semibold">{u.nome}</p>
                    <p className="text-[11.5px] text-ink-faint">{u.email}</p>
                  </div>
                  <span className="rounded-full bg-surface-soft px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">
                    {u.role === "dono" ? "Administrador" : "Usuário"}
                  </span>
                </div>
              ))}
            </div>
            {isDono && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 text-[13px] font-bold">
                  Convidar para a equipe
                </p>
                <InviteForm />

                {convites && convites.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
                      Convites pendentes
                    </p>
                    <div className="flex flex-col gap-2">
                      {convites.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-[10px] border border-border px-3.5 py-2.5"
                        >
                          <div>
                            <p className="text-[13px] font-semibold">{c.nome}</p>
                            <p className="text-[11.5px] text-ink-faint">
                              {c.email} · {c.role === "dono" ? "Administrador" : "Usuário"}
                            </p>
                          </div>
                          <form action={revogarConvite}>
                            <input type="hidden" name="id" value={c.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-ink-faint hover:bg-surface-soft hover:text-coral"
                            >
                              Revogar
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {chamados && chamados.length > 0 && (
            <div className="card px-5 py-5">
              <p className="mb-3 text-[14px] font-bold">Seus chamados</p>
              <div className="flex flex-col gap-2">
                {chamados.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-[10px] border border-border px-3.5 py-2.5 text-[12.5px]"
                  >
                    <span className="font-semibold">{c.assunto}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                        c.status === "resolvido"
                          ? "bg-teal/10 text-teal"
                          : "bg-coral/10 text-coral"
                      }`}
                    >
                      {c.status === "resolvido" ? "Resolvido" : "Aberto"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {isDono && tenant?.nome && (
        <div className="mt-4">
          <ApagarConta tenantNome={tenant.nome} />
        </div>
      )}
    </div>
  );
}

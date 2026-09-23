import { createClient } from "@/lib/supabase/server";
import WhatsAppForm from "./whatsapp-form";
import EmbeddedSignupButton from "./embedded-signup-button";
import InviteForm from "./invite-form";
import BillingPortalButton from "./billing-portal-button";
import { desconectarWhatsApp, revogarConvite } from "./actions";
import { sincronizarPlanoTenant } from "@/lib/sincronizar-plano";

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
      "Tudo do Profissional",
      "Admin do negócio pelo WhatsApp",
      "Sinal antecipado (anti no-show)",
      "Recibo automático por WhatsApp",
      "Suporte prioritário",
    ],
  },
] as const;

export default async function ContaPage() {
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
        .select("id, nome, email, status, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold">
          Conta e assinatura
        </h1>
        <p className="text-[13.5px] text-ink-soft">
          {tenant?.nome} · plano{" "}
          <span className="font-semibold text-ink">
            {PLANO_LABEL[tenant?.plano ?? ""] ?? tenant?.plano}
          </span>
        </p>
      </div>

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
              <BillingPortalButton label="Gerenciar assinatura" />
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

          {conta ? (
            <div>
              <p className="text-[13.5px] font-semibold">
                {conta.display_phone_number ?? conta.phone_number_id}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-faint">
                Conectado em{" "}
                {new Date(conta.connected_at).toLocaleDateString("pt-BR")}
              </p>
              <form action={desconectarWhatsApp} className="mt-4">
                <button
                  type="submit"
                  className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-coral hover:bg-coral/5"
                >
                  Desconectar
                </button>
              </form>
            </div>
          ) : (
            <>
              <p className="mb-4 text-[12.5px] text-ink-soft">
                Conecte o WhatsApp Business do seu negócio pra ivva começar
                a atender seus clientes.
              </p>
              <EmbeddedSignupButton />
              <details className="mt-4 border-t border-border pt-4">
                <summary className="cursor-pointer text-[12.5px] font-bold text-ink-soft hover:text-ink">
                  Prefiro conectar manualmente com meus próprios dados de
                  desenvolvedor
                </summary>
                <div className="mt-3">
                  <WhatsAppForm />
                </div>
              </details>
            </>
          )}

          {isDono && conta && (
            <div className="mt-4 border-t border-border pt-4">
              <a
                href="/robo"
                className="flex items-center justify-between rounded-[10px] bg-surface-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
              >
                Personalidade, tom e automações do robô ficam em
                Configuração do robô
                <span aria-hidden>→</span>
              </a>
            </div>
          )}
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
                    {u.role === "dono" ? "Dono" : "Profissional"}
                  </span>
                </div>
              ))}
            </div>
            {isDono && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 text-[13px] font-bold">
                  Convidar profissional
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
                            <p className="text-[11.5px] text-ink-faint">{c.email}</p>
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

    </div>
  );
}

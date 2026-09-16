import { createClient } from "@/lib/supabase/server";
import WhatsAppForm from "./whatsapp-form";
import InviteForm from "./invite-form";
import AssistantForm from "./assistant-form";
import BotSettingsForm from "./bot-settings-form";
import { desconectarWhatsApp, revogarConvite } from "./actions";

const PLANO_LABEL: Record<string, string> = {
  essencial: "Essencial",
  profissional: "Profissional",
  completo: "Completo",
};

export default async function ContaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role, tenants(nome, plano, identidade_assistente)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const tenant = perfil?.tenants as unknown as {
    nome: string;
    plano: string;
    identidade_assistente: {
      nome_assistente?: string;
      tom?: string;
      regras?: string[];
      horario_atendimento?: string;
    } | null;
  } | null;

  const isDono = perfil?.role === "dono";

  const [{ data: conta }, { data: equipe }, { data: chamados }, { data: convites }, { data: botSettings }] =
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
      // Ainda não existe linha pra todo tenant (só é criada quando o dono
      // salva pela primeira vez) — maybeSingle cobre o caso de não existir.
      supabase.from("bot_settings").select("*").maybeSingle(),
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
              <WhatsAppForm />
            </>
          )}

          {isDono && conta && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-1 text-[13px] font-bold">
                Personalidade do atendimento
              </p>
              <p className="mb-3 text-[12px] text-ink-faint">
                Como a ivva se apresenta e conversa com seus clientes no
                WhatsApp.
              </p>
              <AssistantForm identidade={tenant?.identidade_assistente ?? null} />
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

      {isDono && (
        <div className="card mt-4 px-5 py-5">
          <p className="mb-1 text-[14px] font-bold">Configurações do robô</p>
          <p className="mb-4 text-[12px] text-ink-faint">
            Pós-venda, reengajamento, aniversário e o canal de comandos que
            você usa pra falar com o robô como dono.
          </p>
          <BotSettingsForm settings={botSettings} />
        </div>
      )}
    </div>
  );
}

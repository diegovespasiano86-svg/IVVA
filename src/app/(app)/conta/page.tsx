import { createClient } from "@/lib/supabase/server";
import WhatsAppForm from "./whatsapp-form";
import { desconectarWhatsApp } from "./actions";

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
    .select("tenant_id, role, tenants(nome, plano)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const tenant = perfil?.tenants as unknown as {
    nome: string;
    plano: string;
  } | null;

  const [{ data: conta }, { data: equipe }, { data: chamados }] =
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
            <p className="mt-3 text-[11.5px] text-ink-faint">
              Convite de novo profissional ainda não é self-service — fale
              com quem implantou a ivva.
            </p>
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
                          : "bg-surface-soft text-ink-soft"
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

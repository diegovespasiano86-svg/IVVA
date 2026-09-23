import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import { navForRole, type Role } from "@/lib/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("users")
    .select("nome, role, tenant_id, tenants(nome)")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="max-w-[420px]">
          <h1 className="font-display text-[19px] font-bold">
            Seu acesso ainda não foi configurado
          </h1>
          <p className="mt-2 text-[13.5px] text-ink-soft">
            Sua conta existe, mas ainda não está vinculada a nenhum negócio
            na ivva. Fale com quem está implantando o sistema para liberar
            seu acesso.
          </p>
        </div>
      </main>
    );
  }

  const role = perfil.role as Role;
  const tenantNome =
    (perfil.tenants as unknown as { nome: string } | null)?.nome ?? "ivva";
  const items = navForRole(role);

  // Só o dono pode agir sobre isso (reconectar em /conta, ver chamados) —
  // não vale a pena mostrar/consultar pra profissional, que não tem o que
  // fazer com o aviso.
  let whatsappEmErro = false;
  let automacoesPausadasAte: string | null = null;
  let chamadosAbertos = 0;
  let sugestoesPendentes = 0;
  if (role === "dono") {
    const [{ data: conta }, { count }, { count: sugestoesCount }] = await Promise.all([
      supabase
        .from("whatsapp_accounts")
        .select("status, automacoes_pausadas_ate")
        .eq("tenant_id", perfil.tenant_id)
        .maybeSingle(),
      supabase
        .from("help_requests")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", perfil.tenant_id)
        .neq("status", "resolvido"),
      supabase
        .from("knowledge_base_sugestoes")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", perfil.tenant_id)
        .eq("confirmado", false),
    ]);
    whatsappEmErro = conta?.status === "erro";
    if (conta?.automacoes_pausadas_ate && new Date(conta.automacoes_pausadas_ate) > new Date()) {
      automacoesPausadasAte = conta.automacoes_pausadas_ate;
    }
    chamadosAbertos = count ?? 0;
    sugestoesPendentes = sugestoesCount ?? 0;
  }

  // Intervenção humana pendente é o alerta mais crítico do app — cliente
  // real esperando resposta agora — então vale tanto pro dono quanto pro
  // profissional (os dois têm acesso a SAC) e nunca fica atrás de plano:
  // segurança/reputação do negócio do cliente não é feature paga.
  const { count: aguardandoHumanoCount } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", perfil.tenant_id)
    .eq("status", "humano");
  const aguardandoHumano = aguardandoHumanoCount ?? 0;

  const alertHrefs = [
    ...(chamadosAbertos > 0 ? ["/conta"] : []),
    ...(aguardandoHumano > 0 ? ["/sac"] : []),
    ...(sugestoesPendentes > 0 ? ["/base-conhecimento"] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        items={items}
        negocio={tenantNome}
        nome={perfil.nome}
        role={role}
        alertHrefs={alertHrefs}
      />
      <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
        {aguardandoHumano > 0 && (
          <a
            href="/sac"
            className="mb-5 flex animate-pulse items-center gap-2.5 rounded-[12px] bg-coral px-4 py-3.5 text-[13.5px] font-bold text-white shadow-[0_4px_16px_-4px_rgba(255,107,91,0.6)]"
          >
            <svg className="icon shrink-0" viewBox="0 0 24 24" style={{ color: "#fff" }}>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            {aguardandoHumano === 1
              ? "1 cliente está aguardando atendimento humano agora"
              : `${aguardandoHumano} clientes estão aguardando atendimento humano agora`}
            <span className="ml-auto shrink-0 underline underline-offset-2">
              Ver na Central de SAC →
            </span>
          </a>
        )}
        {whatsappEmErro && (
          <a
            href="/conta"
            className="mb-5 block rounded-[12px] border border-coral bg-coral/10 px-4 py-3 text-[13px] font-semibold text-coral"
          >
            ⚠️ O WhatsApp parou de enviar mensagens — clientes estão sem resposta. Clique aqui pra reconectar em Conta.
          </a>
        )}
        {!whatsappEmErro && automacoesPausadasAte && (
          <a
            href="/conta"
            className="mb-5 block rounded-[12px] border border-purple bg-purple/10 px-4 py-3 text-[13px] font-semibold text-purple"
          >
            ⚠️ Disparos automáticos pausados até{" "}
            {new Date(automacoesPausadasAte).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            por segurança de qualidade do número — o atendimento a clientes continua normal.
          </a>
        )}
        {children}
      </main>
    </div>
  );
}

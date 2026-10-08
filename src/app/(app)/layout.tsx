import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/app-shell";
import Alert from "@/components/alert";
import { ListChecks, Clock } from "lucide-react";
import { resumoTarefasCrm } from "@/lib/crm-tarefas";
import UsoIaAviso from "@/components/uso-ia-aviso";
import { obterResumoUso, reconciliarCreditos, type ResumoUso } from "@/lib/uso-ia";
import type { Role } from "@/lib/nav";
import { termosDoNegocio } from "@/lib/termos";

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
    .select("nome, role, tenant_id, tenants(nome, segmento, termos)")
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
  const tenantTermos = perfil.tenants as unknown as { segmento: string | null; termos: unknown } | null;
  const termos = termosDoNegocio(tenantTermos?.segmento, tenantTermos?.termos);

  // Só o dono pode agir sobre isso (reconectar em /conta, ver chamados) —
  // não vale a pena mostrar/consultar pra profissional, que não tem o que
  // fazer com o aviso.
  let whatsappEmErro = false;
  let automacoesPausadasAte: string | null = null;
  let chamadosAbertos = 0;
  let sugestoesPendentes = 0;
  let roboStatus: "ativo" | "pausado" | "sem-whatsapp" | null = null;
  let resumoUso: ResumoUso | null = null;
  let diasDeTeste: number | null = null;
  if (role === "dono") {
    const [{ data: conta }, { count }, { count: sugestoesCount }, { data: botCfg }] = await Promise.all([
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
      supabase
        .from("bot_settings")
        .select("bot_pausado")
        .eq("tenant_id", perfil.tenant_id)
        .maybeSingle(),
    ]);
    roboStatus =
      !conta || conta.status !== "ativo" ? "sem-whatsapp" : botCfg?.bot_pausado ? "pausado" : "ativo";
    whatsappEmErro = conta?.status === "erro";
    if (conta?.automacoes_pausadas_ate && new Date(conta.automacoes_pausadas_ate) > new Date()) {
      automacoesPausadasAte = conta.automacoes_pausadas_ate;
    }
    chamadosAbertos = count ?? 0;

    // Dias que faltam do teste grátis (14 dias a partir da criação da assinatura). Falha aqui nunca derruba a tela.
    try {
      const { data: assinatura } = await supabase
        .from("subscriptions")
        .select("status, created_at")
        .eq("tenant_id", perfil.tenant_id)
        .maybeSingle();
      if (assinatura && (assinatura.status === "trial" || assinatura.status === "trialing") && assinatura.created_at) {
        const fim = new Date(assinatura.created_at).getTime() + 14 * 24 * 60 * 60 * 1000;
        const dias = Math.ceil((fim - Date.now()) / (24 * 60 * 60 * 1000));
        if (dias >= 0 && dias <= 14) diasDeTeste = dias;
      }
    } catch (err) {
      console.error("[layout] falha ao ler o teste grátis", err);
    }
    sugestoesPendentes = sugestoesCount ?? 0;

    // Consumo das conversas da IA no mês (avisos de 80/90/100%). Antes, credita
    // compras de crédito já pagas que ainda não foram confirmadas (cliente que
    // fechou a aba do pagamento antes de voltar). Falha aqui nunca derruba a tela.
    try {
      await reconciliarCreditos(supabase);
      resumoUso = await obterResumoUso(supabase);
    } catch (err) {
      console.error("[layout] falha ao ler o uso da IA", err);
    }
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

  // Tarefas e lembretes do CRM marcados para hoje (ou atrasados): sobem como aviso no topo e no sino.
  // A RLS já limita: administrador vê as do negócio, usuário só as dele. Falha aqui nunca derruba a tela.
  let tarefasCrm = { hoje: 0, atrasadas: 0, mes: 0 };
  try {
    tarefasCrm = await resumoTarefasCrm(supabase);
  } catch (err) {
    console.error("[layout] falha ao ler tarefas do CRM", err);
  }

  const alertHrefs = [
    ...(chamadosAbertos > 0 ? ["/conta"] : []),
    ...(aguardandoHumano > 0 ? ["/sac"] : []),
    ...(sugestoesPendentes > 0 ? ["/base-conhecimento"] : []),
    ...(tarefasCrm.hoje + tarefasCrm.atrasadas > 0 ? ["/crm"] : []),
  ];

  return (
    <AppShell
      role={role}
      negocio={tenantNome}
      nome={perfil.nome}
      alertHrefs={alertHrefs}
      roboStatus={roboStatus}
      termos={termos}
    >
        {diasDeTeste !== null && (
          <Alert tone="info" icon={Clock} action={{ href: "/assinatura", label: "Minha assinatura" }}>
            {diasDeTeste === 0
              ? "Hoje é o último dia do seu teste grátis."
              : diasDeTeste === 1
                ? "Falta 1 dia para acabar o seu teste grátis."
                : `Faltam ${diasDeTeste} dias para acabar o seu teste grátis.`}{" "}
            Depois dele, a cobrança do plano segue normalmente. Você pode cancelar quando quiser.
          </Alert>
        )}
        {resumoUso && <UsoIaAviso resumo={resumoUso} />}
        {tarefasCrm.hoje + tarefasCrm.atrasadas > 0 && (
          <Alert tone="info" icon={ListChecks} action={{ href: "/crm?view=tarefas", label: "Ver tarefas" }}>
            {tarefasCrm.hoje > 0
              ? `Você tem ${tarefasCrm.hoje} ${tarefasCrm.hoje === 1 ? "tarefa ou lembrete" : "tarefas e lembretes"} do CRM para hoje`
              : "Você tem tarefas do CRM atrasadas"}
            {tarefasCrm.atrasadas > 0 && tarefasCrm.hoje > 0 ? ` e ${tarefasCrm.atrasadas} atrasada${tarefasCrm.atrasadas === 1 ? "" : "s"}` : ""}
            {tarefasCrm.mes > 0 ? `. No mês, são ${tarefasCrm.mes} a fazer.` : "."}
          </Alert>
        )}
        {aguardandoHumano > 0 && (
          <Alert tone="danger" pulse action={{ href: "/sac", label: "Abrir o SAC" }}>
            {aguardandoHumano === 1
              ? "1 cliente está aguardando atendimento humano agora."
              : `${aguardandoHumano} clientes estão aguardando atendimento humano agora.`}
          </Alert>
        )}
        {whatsappEmErro && (
          <Alert tone="danger" action={{ href: "/canais", label: "Reconectar" }}>
            O WhatsApp parou de enviar mensagens e os clientes estão sem resposta. Reconecte para restabelecer o atendimento.
          </Alert>
        )}
        {!whatsappEmErro && automacoesPausadasAte && (
          <Alert tone="warn">
            Disparos automáticos pausados até{" "}
            {new Date(automacoesPausadasAte).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            por segurança de qualidade do número. O atendimento a clientes continua normal.
          </Alert>
        )}
        {children}
    </AppShell>
  );
}

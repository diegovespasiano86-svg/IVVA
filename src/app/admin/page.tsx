import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolverChamado } from "./actions";

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

  const [{ data }, { data: chamadosData }] = await Promise.all([
    supabase.rpc("admin_tenants_overview"),
    supabase.rpc("admin_chamados_recentes"),
  ]);
  const tenants = (data ?? []) as AdminTenantRow[];
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

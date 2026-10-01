import Link from "next/link";
import { CircleAlert, Megaphone, Plus, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import EmptyState from "@/components/empty-state";
import { STATUS_CAMPANHA, type StatusCampanha } from "@/lib/campanhas";

export default async function CampanhasPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle();

  if (perfil?.role !== "dono") {
    return (
      <div>
        <PageHeader icon={Megaphone} title="Campanhas" />
        <div className="card">
          <EmptyState icon={Megaphone} title="Só o dono do negócio gerencia campanhas" text="Peça ao dono para criar e acompanhar os disparos." />
        </div>
      </div>
    );
  }

  const { data: campanhas } = await supabase
    .from("campaigns")
    .select("id, nome, status, total, enviados, falhas, ignorados, created_at, agendada_para")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <PageHeader
        icon={Megaphone}
        title="Campanhas"
        subtitle="Mande uma mensagem para vários clientes de uma vez, só para quem aceita receber."
        actions={
          <>
            <Link href="/campanhas/automacoes" className="btn btn-secondary btn-md">
              <Zap size={15} /> Automações
            </Link>
            <Link href="/campanhas/nova" className="btn btn-primary btn-md">
              <Plus size={15} /> Nova campanha
            </Link>
          </>
        }
      />

      {sp.erro && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-coral/25 bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">
          <CircleAlert size={16} /> {sp.erro}
        </p>
      )}

      <div className="card overflow-hidden">
        {(campanhas ?? []).length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Você ainda não fez nenhuma campanha"
            text="Comece por um modelo pronto, como “Sentimos sua falta”, que traz de volta clientes que sumiram."
            action={{ href: "/campanhas/nova", label: "Criar a primeira campanha" }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean min-w-[680px]">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Situação</th>
                  <th className="num">Público</th>
                  <th>Progresso</th>
                  <th>Criada em</th>
                </tr>
              </thead>
              <tbody>
                {(campanhas ?? []).map((c) => {
                  const st = STATUS_CAMPANHA[c.status as StatusCampanha] ?? STATUS_CAMPANHA.rascunho;
                  const pct = c.total > 0 ? Math.min(100, Math.round(((c.enviados + c.falhas) / c.total) * 100)) : 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/campanhas/${c.id}`} className="font-bold hover:text-purple">
                          {c.nome}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${st.badge}`}>{st.label}</span>
                        {c.status === "agendada" && c.agendada_para && (
                          <span className="ml-2 text-[11.5px] text-ink-soft">{new Date(c.agendada_para).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                      </td>
                      <td className="num">{c.total}</td>
                      <td>
                        {c.status === "rascunho" ? (
                          <span className="text-[12px] text-ink-faint">Não iniciada</span>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-soft">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#0a7f69] to-[#6d5be0]" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[12px] font-semibold tabular-nums text-ink-soft">
                              {c.enviados}/{c.total}
                              {c.falhas > 0 && <span className="text-coral"> · {c.falhas} falhas</span>}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="text-[12.5px] text-ink-soft">{new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
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

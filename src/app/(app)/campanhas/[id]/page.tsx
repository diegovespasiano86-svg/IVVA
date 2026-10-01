import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import EmptyState from "@/components/empty-state";
import PreviewWhatsApp from "@/components/preview-whatsapp";
import { MOTIVO_IGNORADO, STATUS_CAMPANHA, STATUS_DESTINATARIO, type StatusCampanha } from "@/lib/campanhas";
import { formatarTelefone } from "@/lib/clientes";
import CampanhaEditor, { type CampanhaEdicao } from "./campanha-editor";
import CampanhaAcompanhamento from "./campanha-acompanhamento";

export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role, tenants(nome)").eq("id", user?.id ?? "").maybeSingle();

  if (perfil?.role !== "dono") {
    return (
      <div>
        <PageHeader icon={Megaphone} title="Campanha" />
        <div className="card">
          <EmptyState icon={Megaphone} title="Só o dono do negócio gerencia campanhas" />
        </div>
      </div>
    );
  }

  const { data: c } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const negocio = (perfil.tenants as unknown as { nome: string } | null)?.nome ?? "Seu negócio";
  const st = STATUS_CAMPANHA[c.status as StatusCampanha] ?? STATUS_CAMPANHA.rascunho;

  const cabecalho = (
    <>
      <Link href="/campanhas" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={15} /> Campanhas
      </Link>
      <PageHeader icon={Megaphone} title={c.nome} subtitle="Campanha de WhatsApp" actions={<span className={`badge ${st.badge}`}>{st.label}</span>} />
    </>
  );

  if (c.status === "rascunho") {
    const [{ data: listas }, { data: etiquetas }, { data: wa }] = await Promise.all([
      supabase.from("contact_lists").select("id, nome").order("nome"),
      supabase.from("labels").select("id, nome").order("nome"),
      supabase.from("whatsapp_accounts").select("status").maybeSingle(),
    ]);
    const edicao: CampanhaEdicao = {
      id: c.id,
      nome: c.nome,
      template_nome: c.template_nome,
      template_idioma: c.template_idioma,
      usa_nome: c.usa_nome,
      mensagem_previa: c.mensagem_previa,
      audiencia: c.audiencia as CampanhaEdicao["audiencia"],
      consentimento: !!c.consentimento_confirmado_em,
      total: c.total,
      ignorados: c.ignorados,
    };
    return (
      <div>
        {cabecalho}
        <CampanhaEditor campanha={edicao} listas={listas ?? []} etiquetas={etiquetas ?? []} whatsappAtivo={wa?.status === "ativo"} negocio={negocio} />
      </div>
    );
  }

  const { data: dest } = await supabase.from("campaign_recipients").select("nome, telefone, status, erro").eq("campaign_id", id).order("created_at").limit(5000);
  const lista = dest ?? [];
  const pendentes = lista.filter((d) => d.status === "pendente" || d.status === "enviando").length;
  const ordem: Record<string, number> = { falhou: 0, enviando: 1, pendente: 2, enviado: 3, ignorado: 4 };
  const mostrar = [...lista].sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9)).slice(0, 100);

  return (
    <div>
      {cabecalho}
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <CampanhaAcompanhamento
            id={c.id}
            status={c.status as StatusCampanha}
            total={c.total}
            enviados={c.enviados}
            falhas={c.falhas}
            ignorados={c.ignorados}
            pendentes={pendentes}
            pausaMotivo={c.pausa_motivo}
          />
          <section className="card overflow-hidden">
            <header className="border-b border-border px-5 py-3.5">
              <h2 className="text-[14px] font-extrabold">Destinatários</h2>
              <p className="text-[12px] text-ink-soft">Mostrando {mostrar.length} de {lista.length}. Os que falharam aparecem primeiro.</p>
            </header>
            <div className="max-h-[480px] overflow-auto">
              <table className="table-clean min-w-[520px]">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Telefone</th>
                    <th>Situação</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {mostrar.map((d, i) => {
                    const s = STATUS_DESTINATARIO[d.status] ?? STATUS_DESTINATARIO.pendente;
                    return (
                      <tr key={i}>
                        <td className="font-semibold">{d.nome ?? "—"}</td>
                        <td className="text-ink-soft">{formatarTelefone(d.telefone)}</td>
                        <td>
                          <span className={`badge ${s.badge}`}>{s.label}</span>
                        </td>
                        <td className="max-w-[220px] truncate text-[12px] text-ink-soft" title={d.erro ?? ""}>
                          {d.erro ? MOTIVO_IGNORADO[d.erro] ?? d.erro : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <aside className="lg:sticky lg:top-20">
          <p className="mb-3 text-center text-[12px] font-bold uppercase tracking-wide text-ink-faint">Mensagem enviada</p>
          <PreviewWhatsApp texto={c.mensagem_previa ?? ""} negocio={negocio} />
          <p className="mt-3 text-center text-[11.5px] text-ink-soft">Modelo: <strong>{c.template_nome}</strong> ({c.template_idioma})</p>
        </aside>
      </div>
    </div>
  );
}

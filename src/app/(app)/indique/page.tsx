import { Gift, MessageCircle } from "lucide-react";
import PageHeader from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { REGRAS_INDICACAO } from "@/lib/indicacao";
import CopiarLink from "./copiar-link";

const STATUS: Record<string, { rotulo: string; classe: string }> = {
  aguardando: { rotulo: "Aguardando os 30 dias do plano mensal", classe: "bg-purple/10 text-purple" },
  paga: { rotulo: "Desconto liberado", classe: "bg-teal/10 text-teal" },
  recusada: { rotulo: "Não elegível", classe: "bg-coral/10 text-coral" },
  expirada: { rotulo: "Não virou cliente", classe: "bg-surface-soft text-ink-soft" },
};

const MOTIVO: Record<string, string> = {
  plano_anual: "plano anual não participa",
  indicado_cancelou: "o indicado cancelou",
  indicador_sem_assinatura: "sua assinatura não estava ativa",
};

function mascarar(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 1)}***@${d ?? ""}`;
}

export default async function IndiquePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (perfil?.role !== "dono") {
    return <div className="card px-5 py-6 text-[13.5px] text-ink-soft">Só o dono do negócio acessa o Indique e ganhe.</div>;
  }

  const { data: codigo } = await supabase.rpc("indicacao_codigo");
  const { data: lista } = await supabase
    .from("indicacoes")
    .select("id, email_indicado, status, motivo, valor_centavos, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const link = codigo ? `https://app.ivva.app.br/planos?ref=${codigo}` : null;
  const pagas = (lista ?? []).filter((i) => i.status === "paga");
  const totalCentavos = pagas.reduce((s, i) => s + Number(i.valor_centavos ?? 0), 0);
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const mensagem = encodeURIComponent(`Oi! Uso a ivva, a atendente de WhatsApp com IA que agenda e vende por mim. Dá para testar 14 dias grátis por este link: ${link ?? ""}`);

  return (
    <div className="mx-auto max-w-[820px]">
      <PageHeader icon={Gift} title="Indique e ganhe" subtitle="Ganhe R$ 150 de desconto na mensalidade para cada negócio que você indicar." />

      <section className="card mb-4 px-5 py-5">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-faint">Seu link de indicação</p>
        {link ? (
          <>
            <p className="mt-1.5 break-all rounded-[10px] bg-surface-soft px-3.5 py-2.5 text-[13.5px] font-semibold">{link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopiarLink link={link} />
              <a href={`https://wa.me/?text=${mensagem}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-md">
                <MessageCircle size={15} /> Enviar pelo WhatsApp
              </a>
            </div>
            <p className="mt-2 text-[12px] text-ink-faint">Seu código: <b>{codigo}</b></p>
          </>
        ) : (
          <p className="mt-1.5 text-[13px] text-ink-soft">Não foi possível gerar o seu link agora. Tente de novo em instantes.</p>
        )}
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="card px-5 py-4">
          <p className="text-[11.5px] text-ink-faint">Descontos liberados</p>
          <p className="font-display text-[22px] font-extrabold">{brl(totalCentavos)}</p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-[11.5px] text-ink-faint">Indicações aguardando</p>
          <p className="font-display text-[22px] font-extrabold">{(lista ?? []).filter((i) => i.status === "aguardando").length}</p>
        </div>
      </section>

      <section className="card mb-4 px-5 py-5">
        <h2 className="text-[14px] font-extrabold">Regras</h2>
        <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-[13px] text-ink-soft">
          {REGRAS_INDICACAO.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="card px-5 py-5">
        <h2 className="text-[14px] font-extrabold">Suas indicações</h2>
        {!lista || lista.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-soft">Ainda não há indicações. Compartilhe o seu link para começar.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {lista.map((i) => {
              const st = STATUS[i.status] ?? STATUS.aguardando;
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border px-4 py-2.5 text-[13px]">
                  <span className="font-semibold">{mascarar(i.email_indicado)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${st.classe}`}>
                    {st.rotulo}
                    {i.status === "recusada" && i.motivo && MOTIVO[i.motivo] ? `: ${MOTIVO[i.motivo]}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

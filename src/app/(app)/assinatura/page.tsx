import { CreditCard, FileText, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sincronizarPlanoTenant } from "@/lib/sincronizar-plano";
import { CONVERSAS_POR_PLANO, formatarNumero } from "@/lib/planos";

const PLANOS: Record<string, { nome: string; preco: string }> = {
  essencial: { nome: "Essencial", preco: "R$ 297" },
  profissional: { nome: "Profissional", preco: "R$ 397" },
  completo: { nome: "Completo", preco: "R$ 597" },
};

const STATUS: Record<string, { rotulo: string; tom: string }> = {
  trialing: { rotulo: "Em teste grátis", tom: "bg-teal/10 text-teal" },
  active: { rotulo: "Ativa", tom: "bg-teal/10 text-teal" },
  past_due: { rotulo: "Pagamento pendente", tom: "bg-coral/10 text-coral" },
  unpaid: { rotulo: "Pagamento pendente", tom: "bg-coral/10 text-coral" },
  canceled: { rotulo: "Cancelada", tom: "bg-surface-soft text-ink-soft" },
};

const AVISOS: Record<string, string> = {
  dono: "Só o dono do negócio pode gerenciar a assinatura.",
  "sem-assinatura": "Ainda não encontramos a sua cobrança. Fale com a gente em contato@ivva.app.br.",
  portal: "Não conseguimos abrir o portal agora. Tente de novo em instantes.",
};

export default async function AssinaturaPage(props: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase
    .from("users")
    .select("tenant_id, role, tenants(plano)")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const isDono = perfil?.role === "dono";

  if (!isDono) {
    return <div className="card px-5 py-6 text-[13.5px] text-ink-soft">Só o dono do negócio pode gerenciar a assinatura.</div>;
  }

  let plano = (perfil?.tenants as unknown as { plano: string } | null)?.plano ?? "essencial";
  let status = "";
  if (perfil?.tenant_id) {
    const { data: assinatura } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, status")
      .eq("tenant_id", perfil.tenant_id)
      .maybeSingle();
    status = assinatura?.status ?? "";
    // Quem trocou de plano no portal volta para cá: atualiza o plano gravado.
    const novo = await sincronizarPlanoTenant(supabase, perfil.tenant_id, assinatura?.stripe_customer_id ?? null);
    if (novo) plano = novo;
  }

  const info = PLANOS[plano] ?? PLANOS.essencial;
  const st = STATUS[status];

  const acoes = [
    { href: "/assinatura/gerenciar", icon: Repeat, titulo: "Trocar de plano", texto: "Suba ou desça de plano quando quiser." },
    { href: "/assinatura/gerenciar?acao=cartao", icon: CreditCard, titulo: "Atualizar forma de pagamento", texto: "Troque o cartão usado na cobrança." },
    { href: "/assinatura/gerenciar", icon: FileText, titulo: "Faturas e recibos", texto: "Veja e baixe os pagamentos anteriores." },
  ];

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="font-display text-[22px] font-bold">Minha assinatura</h1>
      <p className="mb-5 text-[13px] text-ink-soft">Plano, pagamento e faturas do seu negócio.</p>

      {erro && AVISOS[erro] && (
        <p role="alert" className="mb-4 rounded-xl bg-coral/10 px-4 py-3 text-[13px] font-semibold text-coral">
          {AVISOS[erro]}
        </p>
      )}

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-faint">Plano atual</p>
          <p className="font-display text-[22px] font-extrabold">
            {info.nome} <span className="text-[14px] font-semibold text-ink-faint">{info.preco}/mês</span>
          </p>
          <p className="text-[12.5px] text-ink-soft">
            {formatarNumero(CONVERSAS_POR_PLANO[plano as keyof typeof CONVERSAS_POR_PLANO] ?? 0)} conversas por mês com a IA
          </p>
        </div>
        {st && <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${st.tom}`}>{st.rotulo}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {acoes.map((a) => (
          <a key={a.titulo} href={a.href} className="card flex flex-col gap-2 px-4 py-4 transition-colors hover:border-purple/50">
            <a.icon size={20} className="text-purple" />
            <span className="text-[13.5px] font-bold">{a.titulo}</span>
            <span className="text-[12px] text-ink-soft">{a.texto}</span>
          </a>
        ))}
      </div>
      <p className="mt-4 text-[12px] text-ink-faint">
        Ao clicar, você vai para a página segura de pagamentos. A ivva nunca guarda os dados do seu cartão.
      </p>
    </div>
  );
}

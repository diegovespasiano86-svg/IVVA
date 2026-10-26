import { CreditCard, FileText, QrCode, Repeat } from "lucide-react";
import { cobrancaEmAberto } from "@/lib/asaas-ivva";
import type { Ambiente } from "@/lib/asaas";
import { createClient } from "@/lib/supabase/server";
import { sincronizarPlanoTenant } from "@/lib/sincronizar-plano";
import { CONVERSAS_POR_PLANO, POLITICA_CANCELAMENTO, formatarNumero } from "@/lib/planos";

const PLANOS: Record<string, { nome: string; preco: string }> = {
  essencial: { nome: "Essencial", preco: "R$ 297" },
  profissional: { nome: "Profissional", preco: "R$ 447" },
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
  "sem-assinatura": "Ainda não encontramos a sua cobrança. Fale com o suporte no WhatsApp (11) 92740-9320 ou em contato@ivva.app.br.",
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

  // Quem assinou no Pix não tem portal da Stripe: mostra o período pago e a cobrança em aberto do Asaas.
  const { data: pixDados } = await supabase.rpc("assinatura_pix_do_tenant");
  const pix = pixDados as { subscription: string; ambiente: Ambiente; status: string; ciclo: string; valor: number; pago_ate: string | null } | null;
  if (pix) {
    let aberta: Awaited<ReturnType<typeof cobrancaEmAberto>> = null;
    try {
      aberta = await cobrancaEmAberto(pix.subscription, pix.ambiente);
    } catch (err) {
      console.error("[assinatura] falha ao ler cobrança do Asaas", err);
    }
    return <AssinaturaPix plano={plano} pix={pix} aberta={aberta} />;
  }

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
      <p className="mt-2 text-[12px] text-ink-faint">{POLITICA_CANCELAMENTO}</p>
    </div>
  );
}

const STATUS_PIX: Record<string, { rotulo: string; tom: string }> = {
  ativa: { rotulo: "Ativa", tom: "bg-teal/10 text-teal" },
  vencida: { rotulo: "Pagamento pendente", tom: "bg-coral/10 text-coral" },
  cancelada: { rotulo: "Cancelada", tom: "bg-surface-soft text-ink-soft" },
  aguardando_pagamento: { rotulo: "Aguardando pagamento", tom: "bg-coral/10 text-coral" },
};

const dataBR = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");

function AssinaturaPix({
  plano,
  pix,
  aberta,
}: {
  plano: string;
  pix: { status: string; ciclo: string; valor: number; pago_ate: string | null };
  aberta: { valor: number; vencimento: string; url: string; vencida: boolean } | null;
}) {
  const info = PLANOS[plano] ?? PLANOS.essencial;
  const st = STATUS_PIX[pix.status];
  const valor = Number(pix.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const contato = "mailto:contato@ivva.app.br?subject=" + encodeURIComponent("Minha assinatura (Pix)");

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="font-display text-[22px] font-bold">Minha assinatura</h1>
      <p className="mb-5 text-[13px] text-ink-soft">Plano, pagamento e faturas do seu negócio.</p>

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-faint">Plano atual · pago no Pix</p>
          <p className="font-display text-[22px] font-extrabold">
            {info.nome} <span className="text-[14px] font-semibold text-ink-faint">{valor}/{pix.ciclo === "anual" ? "ano" : "mês"}</span>
          </p>
          <p className="text-[12.5px] text-ink-soft">
            {formatarNumero(CONVERSAS_POR_PLANO[plano as keyof typeof CONVERSAS_POR_PLANO] ?? 0)} conversas por mês com a IA
            {pix.pago_ate && <> · pago até {dataBR(pix.pago_ate)}</>}
          </p>
        </div>
        {st && <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${st.tom}`}>{st.rotulo}</span>}
      </div>

      {aberta ? (
        <a
          href={aberta.url}
          target="_blank"
          rel="noreferrer"
          className={`card mb-4 flex items-center gap-4 px-5 py-4 transition-colors hover:border-purple/50 ${aberta.vencida ? "border-coral/50" : ""}`}
        >
          <QrCode size={26} className={aberta.vencida ? "text-coral" : "text-purple"} />
          <span className="flex-1">
            <span className="block text-[13.5px] font-bold">
              {aberta.vencida ? "Mensalidade vencida" : "Próxima mensalidade"}:{" "}
              {aberta.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · vence em {dataBR(aberta.vencimento)}
            </span>
            <span className="block text-[12px] text-ink-soft">Abra para pagar com o Pix (QR Code ou copia e cola).</span>
          </span>
        </a>
      ) : (
        <p className="card mb-4 px-5 py-4 text-[13px] text-ink-soft">
          Nenhuma mensalidade em aberto. A próxima cobrança chega por e-mail alguns dias antes do vencimento.
        </p>
      )}

      <a href={contato} className="card flex items-center gap-4 px-5 py-4 transition-colors hover:border-purple/50">
        <Repeat size={22} className="text-purple" />
        <span>
          <span className="block text-[13.5px] font-bold">Trocar de plano, passar para o cartão ou cancelar</span>
          <span className="block text-[12px] text-ink-soft">Fale com o suporte no WhatsApp (11) 92740-9320 ou em contato@ivva.app.br que ajustamos a sua assinatura.</span>
        </span>
      </a>
      <p className="mt-4 text-[12px] text-ink-faint">
        As cobranças no Pix são emitidas pelo Asaas, parceiro de pagamentos da ivva. <FileText size={12} className="inline" /> Os
        comprovantes ficam no link de cada cobrança.
      </p>
      <p className="mt-2 text-[12px] text-ink-faint">{POLITICA_CANCELAMENTO}</p>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCheckoutSession } from "@/lib/stripe";
import { getSegmento } from "@/lib/segmentos";

function Painel({ titulo, texto, acao }: { titulo: string; texto: string; acao?: { href: string; rotulo: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[520px] rounded-2xl border border-border bg-surface p-8 text-center shadow-[0_1px_2px_rgba(36,31,46,0.04)]">
        <h1 className="font-display text-[20px] font-bold">{titulo}</h1>
        <p className="mt-2 text-[13.5px] text-ink-soft">{texto}</p>
        {acao && (
          <Link href={acao.href} className="btn mt-6 inline-flex bg-ink px-5 py-2.5 text-[13.5px] text-white">
            {acao.rotulo}
          </Link>
        )}
      </div>
    </main>
  );
}

// Chega aqui quem clicou no botão do e-mail de confirmação. Ao confirmar o e-mail a pessoa já entra logada;
// este passo monta o negócio (com o plano pago e o tipo escolhido) e leva para o sistema.
export default async function AtivarPage(props: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Painel
        titulo="Esse link expirou ou já foi usado"
        texto="Entre com o e-mail e a senha que você criou. Se ainda não conseguir, peça um novo e-mail de confirmação na tela de boas-vindas."
        acao={{ href: "/login", rotulo: "Entrar" }}
      />
    );
  }

  const { data: perfil } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
  if (perfil) redirect("/dashboard");

  if (!sessionId) {
    return <Painel titulo="Link incompleto" texto="Volte ao e-mail de confirmação e clique no botão de novo." />;
  }

  let sessao;
  try {
    sessao = await getCheckoutSession(sessionId);
  } catch (err) {
    console.error("[ativar] não leu o checkout", err instanceof Error ? err.message : err);
    return <Painel titulo="Não encontramos o pagamento" texto="Fale com a gente em contato@ivva.app.br e informe o código CAD-1." />;
  }
  if (sessao.payment_status !== "paid" && sessao.payment_status !== "no_payment_required") {
    return <Painel titulo="Pagamento ainda não confirmado" texto="Assim que ele for confirmado, clique de novo no botão do e-mail." />;
  }

  const emailPagamento = (sessao.customer_details?.email ?? sessao.customer_email ?? "").trim().toLowerCase();
  if (!emailPagamento || emailPagamento !== (user.email ?? "").trim().toLowerCase()) {
    return (
      <Painel
        titulo="Esse acesso não é do e-mail do pagamento"
        texto="Entre com o e-mail usado no pagamento ou fale com a gente em contato@ivva.app.br e informe o código CAD-6."
      />
    );
  }

  const segredo = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!segredo) {
    return <Painel titulo="Quase lá" texto="Configuração do servidor incompleta. Fale com a gente e informe o código CAD-2." />;
  }

  const meta = (user.user_metadata ?? {}) as { nome?: string; segmento?: string };
  const segmentoId = getSegmento(meta.segmento ?? "") ? (meta.segmento as string) : (sessao.metadata?.segmento ?? "outro");
  const segmento = getSegmento(segmentoId);

  const { error } = await supabase.rpc("provision_tenant", {
    p_secret: segredo,
    p_nome: sessao.metadata?.nome_negocio ?? "Meu negócio",
    p_plano: sessao.metadata?.plano ?? "essencial",
    p_stripe_customer_id: sessao.customer ?? null,
    p_user_id: user.id,
    p_user_nome: meta.nome ?? sessao.metadata?.nome ?? "Dono",
    p_user_email: emailPagamento,
    p_segmento: segmentoId,
    p_conhecimento_inicial: segmento?.baseConhecimento ?? null,
  });

  if (error) {
    console.error("[ativar] provision_tenant falhou", error.message);
    return (
      <Painel
        titulo="Seu e-mail foi confirmado, mas faltou montar o negócio"
        texto="Não se preocupe: o pagamento está registrado. Tente de novo e, se repetir, fale com a gente e informe o código CAD-5."
        acao={{ href: `/bem-vindo/ativar?session_id=${encodeURIComponent(sessionId)}`, rotulo: "Tentar de novo" }}
      />
    );
  }

  redirect("/dashboard");
}

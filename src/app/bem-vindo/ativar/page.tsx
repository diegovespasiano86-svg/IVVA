import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerPagamentoCadastro } from "@/lib/pagamento-cadastro";
import { getSegmento } from "@/lib/segmentos";

function Painel({ titulo, texto, acao }: { titulo: string; texto: string; acao?: { href: string; rotulo: string } }) {
  return (
    <div className="rounded-3xl bg-white p-7 text-center text-[#0e0e13] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
      <h1 className="text-[20px] font-extrabold">{titulo}</h1>
      <p className="mt-2 text-[13.5px] text-[#6b6577]">{texto}</p>
      {acao && (
        <Link
          href={acao.href}
          className="mt-6 inline-flex rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)]"
        >
          {acao.rotulo}
        </Link>
      )}
    </div>
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

  let pagamento;
  try {
    pagamento = await lerPagamentoCadastro(sessionId);
  } catch (err) {
    console.error("[ativar] não leu o pagamento", err instanceof Error ? err.message : err);
    return <Painel titulo="Não encontramos o pagamento" texto="Fale com a gente em contato@ivva.app.br e informe o código CAD-1." />;
  }
  if (!pagamento.pago) {
    return <Painel titulo="Pagamento ainda não confirmado" texto="Assim que ele for confirmado, clique de novo no botão do e-mail." />;
  }

  const emailPagamento = pagamento.email;
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
  const segmentoId = getSegmento(meta.segmento ?? "") ? (meta.segmento as string) : (pagamento.segmento ?? "outro");
  const segmento = getSegmento(segmentoId);

  const { data: tenantId, error } = await supabase.rpc("provision_tenant", {
    p_secret: segredo,
    p_nome: pagamento.nomeNegocio ?? "Meu negócio",
    p_plano: pagamento.plano ?? "essencial",
    p_stripe_customer_id: pagamento.stripeCustomerId,
    p_user_id: user.id,
    p_user_nome: meta.nome ?? pagamento.nome ?? "Dono",
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

  // Pix: liga a assinatura do Asaas ao negócio recém-criado (provision_tenant cria a assinatura como teste).
  if (pagamento.pix) {
    const { error: errPix } = await supabase.rpc("assinatura_pix_vincular", { p_secret: segredo, p_ref: sessionId, p_tenant: tenantId });
    if (errPix) console.error("[ativar] assinatura_pix_vincular falhou", errPix.message);
  }

  redirect("/dashboard?boas-vindas=1");
}

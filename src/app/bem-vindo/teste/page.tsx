import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function Painel({ titulo, texto, acao }: { titulo: string; texto: string; acao?: { href: string; rotulo: string } }) {
  return (
    <div className="rounded-3xl bg-white p-7 text-center text-[#0e0e13] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
      <h1 className="text-[20px] font-extrabold">{titulo}</h1>
      <p className="mt-2 text-[13.5px] text-[#6b6577]">{texto}</p>
      {acao && (
        <Link href={acao.href} className="mt-6 inline-flex rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-6 py-3 text-[14px] font-semibold text-white">
          {acao.rotulo}
        </Link>
      )}
    </div>
  );
}

// Conta de teste sem cartão: só funciona para e-mails que a equipe cadastrou em contas_teste (a função do banco confere).
export default async function ContaTestePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <Painel titulo="Entre primeiro" texto="Entre com o e-mail da conta de teste e abra esta página de novo." acao={{ href: "/login", rotulo: "Entrar" }} />;
  }

  const { data: perfil } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
  if (perfil) redirect("/dashboard");

  const segredo = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!segredo) return <Painel titulo="Configuração incompleta" texto="Falta o segredo do servidor." />;

  const { error } = await supabase.rpc("provisionar_conta_teste", { p_secret: segredo });
  if (error) {
    console.error("[conta-teste] falhou", error.message);
    return <Painel titulo="Este e-mail não é de uma conta de teste" texto="A conta de teste precisa estar cadastrada pela equipe da ivva." />;
  }

  redirect("/dashboard?boas-vindas=1");
}

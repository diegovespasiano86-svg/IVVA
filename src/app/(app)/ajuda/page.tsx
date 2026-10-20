import { CircleHelp, MessageCircle } from "lucide-react";
import PageHeader from "@/components/page-header";
import CentralAjuda from "@/components/ajuda/central";
import { createClient } from "@/lib/supabase/server";
import { guiasDoPerfil } from "@/lib/ajuda-busca";

const WHATSAPP = "https://wa.me/5511999588396?text=Oi!%20Preciso%20de%20ajuda%20na%20ivva.";

export default async function AjudaPage({ searchParams }: { searchParams: Promise<{ q?: string; abrir?: string }> }) {
  const { q, abrir } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle();
  const guias = guiasDoPerfil(perfil?.role === "dono");

  return (
    <div className="mx-auto max-w-[960px]">
      <PageHeader
        icon={CircleHelp}
        title="Aprender"
        subtitle="Busque por uma palavra, assista aos vídeos passo a passo ou abra o guia de cada tela."
      />

      <CentralAjuda guias={guias} busca={q} abrir={abrir} />

      <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div>
          <p className="text-[14px] font-extrabold">Não achou o que precisava?</p>
          <p className="text-[12.5px] text-ink-soft">
            Pergunte ao assistente no botão Aprender, no canto da tela, ou fale com a gente pelo WhatsApp: (11) 99958-8396. Se preferir, escreva para contato@ivva.app.br.
          </p>
        </div>
        <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn btn-primary btn-md">
          <MessageCircle size={16} /> Chamar no WhatsApp
        </a>
      </div>
    </div>
  );
}

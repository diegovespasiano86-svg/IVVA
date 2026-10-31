import { CircleHelp } from "lucide-react";
import PageHeader from "@/components/page-header";
import CentralAjuda from "@/components/ajuda/central";
import { createClient } from "@/lib/supabase/server";
import { guiasDoPerfil } from "@/lib/ajuda-busca";
import FalarComSuporte from "@/components/suporte/falar-com-suporte";
import { SUPORTE_HORARIO, SUPORTE_WHATSAPP_LABEL } from "@/lib/suporte";
import { PLANO_LABEL, type PlanoId } from "@/lib/planos";

export default async function AjudaPage({ searchParams }: { searchParams: Promise<{ q?: string; abrir?: string }> }) {
  const { q, abrir } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role, tenants(nome, plano)").eq("id", user?.id ?? "").maybeSingle();
  const tenant = perfil?.tenants as unknown as { nome: string; plano: PlanoId | null } | null;
  const guias = guiasDoPerfil(perfil?.role === "dono");

  return (
    <div className="mx-auto max-w-[960px]">
      <PageHeader
        icon={CircleHelp}
        title="Guias e vídeos"
        subtitle="Busque por uma palavra, assista aos vídeos passo a passo ou abra o guia de cada tela. Prefere perguntar? Use o botão Pergunte a Ivva."
      />

      <CentralAjuda guias={guias} busca={q} abrir={abrir} />

      <div id="suporte" className="card mt-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-[14px] font-extrabold">Não achou o que precisava?</p>
          <p className="text-[12.5px] text-ink-soft">
            Pergunte à Ivva no botão Pergunte a Ivva, no canto da tela, ou fale com o suporte pelo WhatsApp {SUPORTE_WHATSAPP_LABEL}, em {SUPORTE_HORARIO}. Se preferir, escreva para contato@ivva.app.br.
          </p>
        </div>
        <FalarComSuporte
          contexto={{ negocio: tenant?.nome, plano: PLANO_LABEL[tenant?.plano ?? "essencial"], email: user?.email ?? undefined }}
        />
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import PageHeader from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import ImportarVendas from "./importar-vendas";

export default async function ImportarVendasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (perfil?.role !== "dono") redirect("/relatorios");

  return (
    <div>
      <Link href="/relatorios" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={15} /> Relatórios
      </Link>
      <PageHeader
        icon={Upload}
        title="Importar vendas antigas"
        subtitle="Traga o histórico de meses anteriores para os relatórios e para o perfil de cada cliente. Não mexe no estoque."
      />
      <ImportarVendas />
    </div>
  );
}

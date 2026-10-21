import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import PageHeader from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { temRecurso } from "@/lib/planos";
import ImportarItens from "./importar-itens";

export default async function ImportarCatalogoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role, tenants(plano)").eq("id", user?.id ?? "").maybeSingle();
  if (perfil?.role !== "dono") redirect("/catalogo");
  const estoqueLiberado = temRecurso((perfil?.tenants as unknown as { plano: string } | null)?.plano, "estoque");

  return (
    <div>
      <Link href="/catalogo" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={15} /> Catálogo e estoque
      </Link>
      <PageHeader icon={Upload} title="Importar catálogo e estoque" subtitle="Traga serviços, produtos e insumos de uma planilha, com preço, custo e o saldo atual do estoque." />
      <ImportarItens estoqueLiberado={estoqueLiberado} />
    </div>
  );
}

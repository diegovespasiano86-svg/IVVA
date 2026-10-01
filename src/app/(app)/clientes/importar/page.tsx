import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import PageHeader from "@/components/page-header";
import ImportarCsv from "./importar-csv";

export default function ImportarPage() {
  return (
    <div>
      <Link href="/clientes" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={15} /> Clientes
      </Link>
      <PageHeader icon={Upload} title="Importar clientes" subtitle="Traga sua lista de uma planilha. Quem já está na base não é duplicado." />
      <ImportarCsv />
    </div>
  );
}

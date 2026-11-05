import { Rocket } from "lucide-react";
import PageHeader from "@/components/page-header";
import EstudioBloqueio from "@/components/estudio-bloqueio";
import { acessoEstudio } from "@/lib/estudio";
import ProjetoForm from "./projeto-form";

export default async function ProjetoPage() {
  const a = await acessoEstudio();
  return (
    <div className="mx-auto max-w-[820px]">
      <PageHeader icon={Rocket} title="Faça seu projeto" subtitle="Conte o que você quer. A ivva monta o diagnóstico, o plano e os roteiros." />
      {!a.temCredito && (
        <div className="mb-4">
          <EstudioBloqueio planoMinimo={a.planoMinimo} nomeDoPlano={a.nomeDoPlano} />
        </div>
      )}
      <ProjetoForm bloqueado={!a.temCredito} />
    </div>
  );
}

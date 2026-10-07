import Link from "next/link";
import PageHeader from "@/components/page-header";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SimuladorChat from "./chat";

export default async function SimuladorPage() {
  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("nome, identidade_assistente").maybeSingle();
  const identidade = tenant?.identidade_assistente as { nome_assistente?: string } | null;
  const nome = identidade?.nome_assistente?.trim() || "Seu robô";

  return (
    <div>
      <PageHeader icon={FlaskConical} title="Simulador do robô" subtitle="Converse com a sua IA como se fosse um cliente. Ela usa a base de conhecimento, a personalidade e as regras que você configurou." />

      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-[12.5px] text-ink-soft">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-teal" />
        <p>
          <span className="font-bold text-ink">Modo teste seguro.</span> Nada é enviado por WhatsApp, nenhum agendamento é criado e nenhuma cobrança é gerada. Os horários e preços que ela
          consulta são os reais. Respostas erradas? Ajuste em{" "}
          <Link href="/base-conhecimento" className="font-bold text-purple underline-offset-2 hover:underline">
            Base de conhecimento
          </Link>{" "}
          ou{" "}
          <Link href="/robo" className="font-bold text-purple underline-offset-2 hover:underline">
            Personalidade e regras
          </Link>
          .
        </p>
      </div>

      <SimuladorChat nomeAssistente={nome} />
    </div>
  );
}

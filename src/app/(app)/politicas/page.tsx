import { FileCheck2, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/page-header";
import ContratoTexto from "@/components/contrato-texto";
import { createClient } from "@/lib/supabase/server";
import { CONTRATO_ATUALIZADO, CONTRATO_VERSAO } from "@/lib/contrato";

const LINK = "font-semibold text-purple underline underline-offset-2";

/** Contrato aceito na contratação, política de privacidade e termos, sempre à mão no menu do usuário. */
export default async function PoliticasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: aceite } = user
    ? await supabase
        .from("contrato_aceites")
        .select("versao, aceito_em")
        .eq("user_id", user.id)
        .order("aceito_em", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const aceitoEm = aceite
    ? new Date(aceite.aceito_em).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader icon={ShieldCheck} title="Políticas e privacidade" subtitle="O contrato da sua assinatura e como cuidamos dos seus dados." />

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <FileCheck2 size={20} className="mt-0.5 shrink-0 text-teal" />
            <div>
              <h2 className="text-[16px] font-bold">Contrato de prestação de serviços e termos de uso</h2>
              <p className="mt-0.5 text-[13px] text-ink-soft">
                {aceitoEm
                  ? `Você aceitou este contrato em ${aceitoEm}${aceite?.versao === CONTRATO_VERSAO ? "" : " (versão anterior)"}.`
                  : `Versão vigente desde ${CONTRATO_ATUALIZADO}.`}{" "}
                Última atualização: {CONTRATO_ATUALIZADO}.
              </p>
            </div>
          </div>
          <a href="/contrato" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            Abrir em página separada
          </a>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <ContratoTexto />
        </div>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-[16px] font-bold">Privacidade e termos</h2>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-ink-soft">
          <li>
            <a href="https://ivva.app.br/privacidade" target="_blank" rel="noreferrer" className={LINK}>
              Política de Privacidade
            </a>
            : quais dados tratamos, por quê e por quanto tempo (LGPD).
          </li>
          <li>
            <a href="https://ivva.app.br/termos" target="_blank" rel="noreferrer" className={LINK}>
              Termos de Uso
            </a>
            : o resumo das regras do serviço publicado no site.
          </li>
          <li>
            Pedidos sobre dados pessoais (acesso, correção, exportação ou exclusão): escreva para <b>contato@ivva.app.br</b>.
          </li>
        </ul>
      </section>
    </div>
  );
}

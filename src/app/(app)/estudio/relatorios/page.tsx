import Link from "next/link";
import { FileText } from "lucide-react";
import PageHeader from "@/components/page-header";

const SECOES = [
  ["Resumo executivo", "Onde você está, o que mais pesa e o que fazer primeiro."],
  ["Seu perfil hoje", "Frequência, formatos, engajamento e o que mais funcionou nos seus posts."],
  ["Concorrentes", "Comparativo com até 3 perfis: fato observado separado de inferência."],
  ["O que funcionou e o que não", "Padrões dos vídeos mais vistos, com exemplos."],
  ["Plano de 30 dias", "Calendário com formatos, temas e metas."],
  ["Roteiros com direção", "Falas, pausas de 1 s e de meio segundo, entonação e cortes."],
];

export default function RelatoriosPage() {
  return (
    <div className="mx-auto max-w-[820px]">
      <PageHeader icon={FileText} title="Meus relatórios" subtitle="Cada diagnóstico fica salvo aqui, em PDF com a marca ivva." />
      <section className="card mb-4 px-5 py-5 text-center">
        <p className="text-[14px] font-extrabold">Nenhum relatório ainda</p>
        <p className="mt-1 text-[13px] text-ink-soft">Quando você gerar o primeiro diagnóstico, ele aparece aqui.</p>
        <Link href="/estudio/projeto" className="btn btn-primary btn-md mt-3 inline-flex">Fazer meu projeto</Link>
      </section>
      <section className="card px-5 py-5">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[14px] font-extrabold">Relatório de exemplo</p>
          <span className="rounded-full bg-surface-soft px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase text-ink-faint">Exemplo</span>
        </div>
        <ol className="space-y-2">
          {SECOES.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple/10 text-[12px] font-extrabold text-purple">{i + 1}</span>
              <p className="text-[13px]"><b>{t}.</b> <span className="text-ink-soft">{d}</span></p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[12px] text-ink-faint">Estrutura ilustrativa. O PDF real usa os dados do seu negócio.</p>
      </section>
    </div>
  );
}

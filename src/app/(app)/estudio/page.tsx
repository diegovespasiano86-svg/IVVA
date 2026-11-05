import Link from "next/link";
import { CalendarCheck, Clapperboard, FileText, Film, Lightbulb, Sparkles } from "lucide-react";
import PageHeader from "@/components/page-header";
import { acessoEstudio } from "@/lib/estudio";

const NIVEIS = [
  { icon: Lightbulb, titulo: "Diagnóstico estratégico", texto: "Analisamos seu perfil e até 3 concorrentes e entregamos um PDF com a marca ivva: o que funciona, o que não funciona e o caminho de 30 dias." },
  { icon: FileText, titulo: "Roteiros com direção", texto: "Falas prontas, com pausas e entonação marcadas, para você gravar do seu jeito. Reels, carrosséis, POVs e vídeos curtos." },
  { icon: Film, titulo: "Conteúdo editado", texto: "Você envia os arquivos nomeados do jeito certo e a ivva edita: cortes, legendas, trilha e capa da sua marca." },
  { icon: Sparkles, titulo: "Presença completa", texto: "Projeto sob medida (site, vídeos, estratégia) combinado em uma conversa de 25 minutos com a ivva." },
];

const MODELOS = [
  { src: "modelo-fitness", titulo: "Modelo: academia e bem-estar" },
  { src: "modelo-bebida", titulo: "Modelo: produto e bebida" },
  { src: "ivva-sugerir-aprovar", titulo: "Vídeo feito para a ivva" },
  { src: "ivva-pergunte", titulo: "Pergunte a Ivva" },
];

export default async function EstudioPage() {
  const a = await acessoEstudio();
  return (
    <div className="mx-auto max-w-[980px]">
      <PageHeader
        icon={Clapperboard}
        title="IVVA Estúdio"
        subtitle="Estratégia, roteiro e edição para o conteúdo do seu negócio, feitos com o que a ivva já sabe de você."
        actions={<span className="rounded-full bg-purple/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-purple">Prévia (MVP)</span>}
      />

      <section className="card mb-4 flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold">{a.temCredito ? "Você tem 1 diagnóstico disponível neste ciclo" : `Seu plano (${a.nomeDoPlano}) vê a vitrine e fala com a ivva`}</p>
          <p className="text-[13px] text-ink-soft">
            {a.temCredito ? "Use quando quiser: o PDF fica salvo em Meus relatórios." : `O diagnóstico mensal está incluído a partir do plano ${a.planoMinimo}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/estudio/projeto" className="btn btn-primary btn-md">Fazer meu projeto</Link>
          <Link href="/estudio/reuniao" className="btn btn-secondary btn-md"><CalendarCheck size={15} /> Agendar 25 min</Link>
        </div>
      </section>

      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-faint">Do mais simples ao mais completo</h2>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {NIVEIS.map((n) => (
          <div key={n.titulo} className="card px-5 py-4">
            <n.icon size={18} className="text-purple" />
            <p className="mt-2 text-[14px] font-extrabold">{n.titulo}</p>
            <p className="text-[13px] text-ink-soft">{n.texto}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-faint">Exemplos</h2>
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODELOS.map((m) => (
          <div key={m.src} className="card overflow-hidden">
            <video className="aspect-[9/16] w-full bg-black object-cover" src={`/estudio-ivva/assets/${m.src}.mp4`} poster={`/estudio-ivva/assets/${m.src}.jpg`} controls playsInline preload="none" />
            <p className="px-3.5 py-2.5 text-[12.5px] font-bold">{m.titulo}</p>
          </div>
        ))}
      </div>
      <p className="mb-4 text-[12px] text-ink-faint">Os modelos são exemplos criados para mostrar o estilo. Não são resultados de clientes.</p>
      <a href="/estudio-ivva" target="_blank" rel="noreferrer" className="text-[13px] font-bold text-purple underline">Ver a página pública do Estúdio</a>
    </div>
  );
}

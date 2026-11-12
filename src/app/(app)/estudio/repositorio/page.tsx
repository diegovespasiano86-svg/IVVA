import Link from "next/link";
import { CalendarDays, FileText, FolderOpen, Film, Upload, Package } from "lucide-react";
import PageHeader from "@/components/page-header";

const PASTAS = [
  { icon: FileText, nome: "Roteiros", desc: "Roteiros com direção de fala, pausas e entonação.", exemplo: ["Roteiro 01 - Reel de apresentação.pdf", "Roteiro 02 - Carrossel de dúvidas.pdf"] },
  { icon: Upload, nome: "Seus vídeos enviados", desc: "Os arquivos que você grava e envia para a ivva editar.", exemplo: ["REEL-01_bruto.mp4", "REEL-02_bruto.mp4"] },
  { icon: Film, nome: "Vídeos editados", desc: "O material pronto, para baixar e publicar.", exemplo: ["REEL-01_final.mp4", "CAPA-REEL-01.jpg"] },
  { icon: CalendarDays, nome: "Cronograma de postagens", desc: "O que publicar, quando e em qual formato.", exemplo: ["Cronograma de novembro.pdf"] },
  { icon: Package, nome: "Outros materiais", desc: "Logo, paleta, briefing, relatórios e tudo o mais do projeto.", exemplo: ["Briefing do projeto.pdf"] },
];

/** Repositório do projeto contratado: a ivva anexa o material produzido e o cliente consulta e envia os arquivos dele. */
export default function RepositorioPage() {
  return (
    <div className="mx-auto max-w-[980px]">
      <PageHeader
        icon={FolderOpen}
        title="Repositório do projeto"
        subtitle="Todo o material do seu projeto em um só lugar: roteiros, vídeos, cronogramas e arquivos."
        actions={<span className="rounded-full bg-purple/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-purple">Prévia (MVP)</span>}
      />
      <section className="card mb-4 flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold">Você ainda não tem um projeto contratado</p>
          <p className="text-[13px] text-ink-soft">Quando a ivva fechar o projeto com você, esta área é liberada e a equipe anexa o material aqui.</p>
        </div>
        <Link href="/estudio" className="btn btn-primary btn-md">Pedir proposta</Link>
      </section>
      <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-faint">Como vai ficar (exemplo)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PASTAS.map((p) => (
          <div key={p.nome} className="card px-5 py-4">
            <div className="flex items-center gap-2.5">
              <p.icon size={18} className="text-purple" />
              <p className="text-[14px] font-extrabold">{p.nome}</p>
            </div>
            <p className="mt-1 text-[12.5px] text-ink-soft">{p.desc}</p>
            <ul className="mt-2.5 space-y-1">
              {p.exemplo.map((f) => (
                <li key={f} className="truncate rounded-lg bg-surface-soft px-3 py-1.5 text-[12.5px] text-ink-faint">{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-faint">Nomes de arquivo ilustrativos. Nesta prévia nada é enviado nem guardado.</p>
    </div>
  );
}

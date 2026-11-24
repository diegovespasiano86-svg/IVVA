import Link from "next/link";
import { FolderOpen, FileText, Upload, Film, CalendarDays, Package } from "lucide-react";
import PageHeader from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { acessoEstudio } from "@/lib/estudio";
import { PASTAS, dataBR, type ArquivoEstudio } from "@/lib/estudio-ops";
import EnviarArquivo from "./enviar-arquivo";

const ICONES: Record<string, typeof FileText> = { relatorio: FileText, roteiros: FileText, videos_editados: Film, cronograma: CalendarDays, outros: Package, enviados: Upload };

function tamanho(b: number | null) {
  if (!b) return "";
  return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** Repositório do Estúdio: tudo o que o time entregou e o que o cliente enviou, por pasta. */
export default async function RepositorioPage() {
  const supabase = await createClient();
  const a = await acessoEstudio();
  const { data } = await supabase.from("estudio_arquivos").select("*").order("criado_em", { ascending: false }).limit(500);
  const arquivos = (data ?? []) as ArquivoEstudio[];

  return (
    <div className="mx-auto max-w-[980px]">
      <PageHeader icon={FolderOpen} title="Repositório do projeto" subtitle="Roteiros, vídeos, cronogramas e arquivos do seu projeto em um só lugar." />
      {arquivos.length === 0 && (
        <section className="card mb-4 flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold">Ainda não há arquivos</p>
            <p className="text-[13px] text-ink-soft">O time anexa aqui tudo o que produzir para você. Você também pode enviar os seus vídeos gravados.</p>
          </div>
          <Link href="/estudio" className="btn btn-secondary btn-md">Conhecer o Estúdio</Link>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {PASTAS.map((p) => {
          const Icone = ICONES[p.id];
          const itens = arquivos.filter((x) => x.pasta === p.id);
          return (
            <div key={p.id} className="card px-5 py-4 transition hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center gap-2.5">
                <Icone size={18} className="text-purple" />
                <p className="text-[14px] font-extrabold">{p.label}</p>
                <span className="ml-auto text-[12px] text-ink-faint">{itens.length}</span>
              </div>
              {itens.length === 0 ? (
                <p className="mt-2 text-[12.5px] text-ink-faint">Nada aqui ainda.</p>
              ) : (
                <ul className="mt-2.5 space-y-1">
                  {itens.map((f) => (
                    <li key={f.id}>
                      <a href={`/estudio/arquivo/${f.id}`} target="_blank" rel="noopener" className="flex items-center justify-between gap-2 rounded-lg bg-surface-soft px-3 py-1.5 text-[12.5px] hover:bg-purple/10">
                        <span className="truncate font-semibold">{f.nome}</span>
                        <span className="shrink-0 text-ink-faint">{tamanho(f.tamanho)} · {dataBR(f.criado_em)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {p.id === "enviados" && a.tenantId && <EnviarArquivo tenantId={a.tenantId} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

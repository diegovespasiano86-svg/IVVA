import Link from "next/link";
import { ArrowLeft, ArrowRight, Megaphone, Plus } from "lucide-react";
import PageHeader from "@/components/page-header";
import { MODELOS, SEGMENTOS_CAMPANHA } from "@/lib/campanhas";
import { criarCampanha } from "../actions";

export default function NovaCampanhaPage() {
  return (
    <div>
      <Link href="/campanhas" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={15} /> Campanhas
      </Link>
      <PageHeader icon={Megaphone} title="Nova campanha" subtitle="Escolha um modelo pronto. Você ajusta o texto e o público no próximo passo." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODELOS.map((m) => {
          const seg = SEGMENTOS_CAMPANHA.find((s) => s.id === m.segmento);
          return (
            <form key={m.id} action={criarCampanha} className="card card-lift flex flex-col px-5 py-5">
              <input type="hidden" name="modelo" value={m.id} />
              <h2 className="text-[15px] font-extrabold">{m.titulo}</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft">{m.descricao}</p>
              <p className="mt-3 flex-1 rounded-xl bg-bg px-3 py-2.5 text-[12.5px] leading-snug text-ink-soft">{m.corpo.replace("{{1}}", "Maria")}</p>
              {seg && <p className="mt-2.5 text-[11.5px] font-semibold text-purple">Público sugerido: {seg.label}</p>}
              <button type="submit" className="btn btn-primary btn-md mt-4 self-start">
                Usar este modelo <ArrowRight size={15} className="btn-arrow" />
              </button>
            </form>
          );
        })}

        <form action={criarCampanha} className="card card-lift flex flex-col items-start justify-center border-dashed px-5 py-5">
          <h2 className="text-[15px] font-extrabold">Do zero</h2>
          <p className="mt-0.5 mb-4 text-[12.5px] text-ink-soft">Escreva a sua própria mensagem e escolha o público.</p>
          <button type="submit" className="btn btn-secondary btn-md">
            <Plus size={15} /> Começar em branco
          </button>
        </form>
      </div>
    </div>
  );
}

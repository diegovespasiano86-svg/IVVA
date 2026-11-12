import { acessoEstudio } from "@/lib/estudio";

/** Vitrine: a própria landing do Estúdio (vídeos, trabalhos, case e pedido de proposta), aberta dentro do app. */
export default async function EstudioPage() {
  const a = await acessoEstudio();
  return (
    <div className="-mx-4 -mt-4 md:-mx-7 md:-mt-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface-soft px-4 py-2 text-[12.5px] md:px-7">
        <span className="rounded-full bg-purple/10 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-purple">Prévia (MVP)</span>
        <span className="text-ink-soft">
          {a.temCredito
            ? "Seu plano inclui 1 diagnóstico por ciclo: use em Faça seu projeto."
            : `Seu plano (${a.nomeDoPlano}) vê a vitrine e pede proposta. O diagnóstico mensal vem a partir do ${a.planoMinimo}.`}
        </span>
      </div>
      <iframe
        src="/estudio-ivva"
        title="IVVA Estúdio"
        className="block h-[calc(100dvh-58px-37px)] w-full border-0 bg-[#0d0b14]"
        allow="autoplay; fullscreen"
      />
    </div>
  );
}

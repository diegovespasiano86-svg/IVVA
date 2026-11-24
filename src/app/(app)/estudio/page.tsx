import { acessoEstudio } from "@/lib/estudio";

/** Vitrine: a própria landing do Estúdio, aberta dentro do app já sabendo o plano do negócio (banner, botão e pedido). */
export default async function EstudioPage() {
  const a = await acessoEstudio();
  const plano = a.plano === "essencial" || a.plano === "profissional" || a.plano === "completo" ? a.plano : "";
  const src = `/estudio-ivva?logado=1${plano ? `&plano=${plano}` : ""}`;
  return (
    <div className="-mx-4 -mt-4 md:-mx-7 md:-mt-5">
      <iframe
        src={src}
        title="IVVA Estúdio"
        className="block h-[calc(100dvh-58px)] w-full border-0 bg-[#0E0C16]"
        allow="autoplay; fullscreen"
      />
    </div>
  );
}

import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import ContratoTexto from "@/components/contrato-texto";
import { CONTRATO_ATUALIZADO } from "@/lib/contrato";

export const metadata: Metadata = { title: "Contrato de prestação de serviços · ivva" };

/** Página pública do contrato: o mesmo texto do popup de aceite. */
export default function ContratoPage() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-10">
      <Logo tone="dark" />
      <h1 className="mt-8 font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
        Contrato de prestação de serviços e termos de uso
      </h1>
      <p className="mt-1.5 text-[13px] text-ink-faint">Última atualização: {CONTRATO_ATUALIZADO}</p>
      <div className="mt-8">
        <ContratoTexto />
      </div>
    </main>
  );
}

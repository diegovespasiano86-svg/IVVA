import Link from "next/link";
import { Lock } from "lucide-react";

/** Aviso de recurso do Estúdio que o plano atual não inclui, com saída para a reunião. */
export default function EstudioBloqueio({ planoMinimo, nomeDoPlano }: { planoMinimo: string; nomeDoPlano: string }) {
  return (
    <div className="card flex flex-wrap items-center gap-4 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple/10 text-purple">
        <Lock size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold">Diagnóstico mensal a partir do plano {planoMinimo}</p>
        <p className="text-[13px] text-ink-soft">
          Seu plano atual é o {nomeDoPlano}. Você pode ver a vitrine e pedir uma proposta à ivva quando quiser, em qualquer plano.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/assinatura" className="btn btn-primary btn-md">Ver planos</Link>
        <Link href="/estudio" className="btn btn-secondary btn-md">Pedir proposta</Link>
      </div>
    </div>
  );
}

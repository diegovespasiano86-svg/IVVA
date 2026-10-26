import { CONTRATO } from "@/lib/contrato";

/** Texto do contrato (cláusulas de src/lib/contrato.ts). Usado no popup de aceite e na página /contrato. */
export default function ContratoTexto() {
  return (
    <div className="space-y-6 text-[13.5px] leading-relaxed text-ink-soft">
      {CONTRATO.map((c) => (
        <section key={c.titulo}>
          <h3 className="font-display text-[15px] font-bold text-ink">{c.titulo}</h3>
          {c.paragrafos?.map((p) => (
            <p key={p} className="mt-2">
              {p}
            </p>
          ))}
          {c.itens && (
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              {c.itens.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

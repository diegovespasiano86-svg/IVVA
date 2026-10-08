"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopiarLink({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o link continua visível para copiar à mão.
    }
  }

  return (
    <button type="button" onClick={copiar} className="btn btn-secondary btn-md">
      {copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? "Link copiado" : "Copiar link"}
    </button>
  );
}

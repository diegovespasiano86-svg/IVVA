"use client";

import { useState } from "react";

export default function CopiarLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="max-w-full truncate rounded-lg bg-surface-soft px-2.5 py-1 text-[12px]">{url}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          });
        }}
        className="text-[12px] font-bold text-purple"
      >
        {copiado ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}

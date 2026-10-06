"use client";

import { useState, useSyncExternalStore } from "react";
import { TriangleAlert, X } from "lucide-react";
import ComprarCreditosButton from "@/components/comprar-creditos-button";
import { formatarNumero } from "@/lib/planos";

function semAssinatura() {
  return () => {};
}

// Janela de destaque quando as conversas da IA acabam. Aparece uma vez por sessão do
// navegador (por estado), com o pagamento já pronto. O aviso fixo no topo continua depois.
export default function UsoIaModal({
  estado,
  restam,
  renova,
}: {
  estado: "esgotado_folga" | "bloqueado";
  restam: number;
  renova: string;
}) {
  const chave = `ivva-uso-ia-modal-${estado}`;
  // No servidor (e na hidratação) conta como "já visto", então nada pisca; no navegador
  // lê o sessionStorage. Sem armazenamento disponível, mostra.
  const jaVisto = useSyncExternalStore(
    semAssinatura,
    () => {
      try {
        return sessionStorage.getItem(chave) === "1";
      } catch {
        return false;
      }
    },
    () => true,
  );
  const [fechado, setFechado] = useState(false);

  function fechar() {
    setFechado(true);
    try {
      sessionStorage.setItem(chave, "1");
    } catch {
      /* sem armazenamento: só fecha */
    }
  }

  if (jaVisto || fechado) return null;

  const parada = estado === "bloqueado";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="uso-ia-titulo"
    >
      <div className="relative w-full max-w-[460px] rounded-3xl bg-white p-7 shadow-2xl">
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-full p-1.5 text-ink-faint hover:bg-surface-soft"
        >
          <X size={18} />
        </button>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-coral text-white">
          <TriangleAlert size={24} />
        </span>
        <h2 id="uso-ia-titulo" className="mt-4 font-display text-[22px] font-extrabold leading-tight">
          {parada ? "A IA parou de responder" : "As conversas com a IA acabaram"}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          {parada
            ? "Você usou todas as conversas deste mês. Seus clientes estão sendo encaminhados para a sua equipe até você adicionar créditos."
            : `Você usou todas as conversas do seu plano neste mês. A IA ainda atende na margem de segurança (restam ${formatarNumero(restam)}), mas vai parar quando ela acabar.`}
        </p>
        <p className="mt-3 text-[13px] text-ink-soft">
          Com créditos avulsos, a IA volta (ou continua) na hora. Eles não expiram. Sem comprar, o plano renova em{" "}
          <strong className="text-ink">{renova}</strong>.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ComprarCreditosButton variant="primary" />
          <button type="button" onClick={fechar} className="text-[13px] font-semibold text-ink-faint hover:text-ink">
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

import { Check } from "lucide-react";
import { previaComNome } from "@/lib/campanhas";

/** Como a mensagem aparece no celular do cliente (com o nome de exemplo no lugar de {{1}}). */
export default function PreviewWhatsApp({ texto, negocio }: { texto: string; negocio?: string }) {
  const hora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[28px] border-[6px] border-ink-deep bg-ink-deep shadow-[0_24px_50px_-24px_rgba(20,18,27,0.6)]">
      <div className="flex items-center gap-2 bg-[#075e54] px-3.5 py-2.5 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[11px] font-extrabold">{(negocio ?? "ivva").slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-bold leading-tight">{negocio ?? "Seu negócio"}</p>
          <p className="text-[10px] text-white/70">conta comercial</p>
        </div>
      </div>
      <div className="min-h-[220px] bg-[#ece5dd] px-3 py-4" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
        {texto.trim() ? (
          <div className="relative max-w-[92%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
            <p className="whitespace-pre-wrap text-[12.5px] leading-snug text-[#111b21]">{previaComNome(texto)}</p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
              {hora} <Check size={11} className="text-[#53bdeb]" />
            </p>
          </div>
        ) : (
          <p className="mt-16 text-center text-[12px] text-[#667781]">Escreva a mensagem para ver a prévia</p>
        )}
      </div>
    </div>
  );
}

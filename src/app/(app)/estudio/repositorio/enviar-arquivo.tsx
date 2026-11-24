"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LIMITE_ARQUIVO_MB, nomeSeguro } from "@/lib/estudio-ops";

/** O cliente envia os vídeos que gravou (vai direto para o armazenamento privado do negócio). */
export default function EnviarArquivo({ tenantId }: { tenantId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(files: FileList | null) {
    if (!files?.length) return;
    setEnviando(true);
    setMsg("");
    const sb = createClient();
    let ok = 0;
    for (const f of Array.from(files)) {
      if (f.size > LIMITE_ARQUIVO_MB * 1048576) {
        setMsg(`"${f.name}" passa de ${LIMITE_ARQUIVO_MB} MB. Mande por link do Drive no WhatsApp.`);
        continue;
      }
      const path = `${tenantId}/geral/enviados/${Date.now()}-${nomeSeguro(f.name)}`;
      const up = await sb.storage.from("estudio").upload(path, f, { contentType: f.type || undefined });
      if (up.error) {
        setMsg("Não conseguimos enviar agora. Tente de novo.");
        continue;
      }
      const ins = await sb.from("estudio_arquivos").insert({ tenant_id: tenantId, pasta: "enviados", nome: f.name.slice(0, 120), path, tamanho: f.size, enviado_por: "cliente" });
      if (ins.error) setMsg("O arquivo subiu, mas não conseguimos registrar. Avise o time.");
      else ok++;
    }
    setEnviando(false);
    if (ok) {
      setMsg(`${ok} arquivo${ok > 1 ? "s enviados" : " enviado"}. O time já pode ver.`);
      router.refresh();
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="mt-3">
      <input ref={input} type="file" multiple accept="video/*,image/*,.pdf" className="hidden" id="estudio-up" onChange={(e) => enviar(e.target.files)} />
      <label htmlFor="estudio-up" className={`btn btn-primary btn-md inline-flex cursor-pointer ${enviando ? "pointer-events-none opacity-60" : ""}`}>
        {enviando ? "Enviando…" : "Enviar arquivos"}
      </label>
      <p className="mt-1.5 text-[11.5px] text-ink-faint">Vídeos, fotos ou PDF, até {LIMITE_ARQUIVO_MB} MB cada.</p>
      {msg && <p className="mt-1 text-[12.5px] font-semibold text-purple">{msg}</p>}
    </div>
  );
}

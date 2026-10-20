import { Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { origemDoApp } from "@/lib/origem";
import { definirLinkPublico } from "./link-publico-actions";
import CopiarLink from "./copiar-link";

/** Link público do robô: o dono compartilha (Instagram, cartão, QR) e o cliente tira dúvidas sem login. */
export default async function LinkPublico() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("robo_publico_estado");
  const estado = data as { ativo: boolean; codigo: string | null } | null;
  const ativo = !!estado?.ativo && !!estado.codigo;
  const url = ativo ? `${await origemDoApp()}/r/${estado!.codigo}` : null;

  return (
    <div className="card mb-4 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3f4ef] text-teal">
          <Link2 size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold">Link público do robô</p>
          <p className="text-[12.5px] text-ink-soft">
            Compartilhe no Instagram ou no cartão: o cliente tira dúvidas com o robô sem precisar de login. Ele responde só com a sua base de conhecimento e não agenda nem cobra.
          </p>
          {url && <CopiarLink url={url} />}
        </div>
      </div>
      <form action={definirLinkPublico}>
        <input type="hidden" name="ativo" value={ativo ? "0" : "1"} />
        <button type="submit" className={ativo ? "btn btn-md" : "btn btn-primary btn-md"}>
          {ativo ? "Desligar link" : "Ligar link público"}
        </button>
      </form>
    </div>
  );
}

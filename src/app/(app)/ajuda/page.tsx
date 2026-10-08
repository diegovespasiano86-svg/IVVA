import Link from "next/link";
import { CircleHelp, MessageCircle, PlayCircle } from "lucide-react";
import PageHeader from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { GUIAS } from "@/lib/guias";

const WHATSAPP = "https://wa.me/5511999588396?text=Oi!%20Preciso%20de%20ajuda%20na%20ivva.";

export default async function AjudaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle();
  const ehDono = perfil?.role === "dono";
  const guias = GUIAS.filter((g) => ehDono || !g.soDono);

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader icon={CircleHelp} title="Ajuda" subtitle="Um guia rápido para cada tela. Abra o que precisar." />

      <div className="space-y-2.5">
        {guias.map((g) => (
          <details key={g.id} className="card group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span>
                <span className="block text-[14.5px] font-extrabold">{g.titulo}</span>
                <span className="block text-[12.5px] text-ink-soft">{g.resumo}</span>
              </span>
              <span aria-hidden="true" className="text-[18px] text-ink-faint transition-transform group-open:rotate-45">+</span>
            </summary>

            <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <ol className="list-decimal space-y-2 pl-5 text-[13px] text-ink-soft">
                {g.passos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              {g.video ? (
                <video src={g.video} controls preload="none" className="w-full rounded-xl border border-border bg-black" aria-label={`Vídeo: ${g.titulo}`} />
              ) : (
                <div className="flex min-h-[110px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface-soft text-ink-faint">
                  <PlayCircle size={22} strokeWidth={1.6} />
                  <span className="text-[12px] font-semibold">Vídeo em breve</span>
                </div>
              )}
            </div>
            <Link href={g.href} className="btn btn-secondary btn-sm mt-4">
              Abrir {g.titulo}
            </Link>
          </details>
        ))}
      </div>

      <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div>
          <p className="text-[14px] font-extrabold">Não achou o que precisava?</p>
          <p className="text-[12.5px] text-ink-soft">Fale com a gente pelo WhatsApp: (11) 99958-8396. Se preferir, escreva para contato@ivva.app.br.</p>
        </div>
        <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn btn-primary btn-md">
          <MessageCircle size={16} /> Chamar no WhatsApp
        </a>
      </div>
    </div>
  );
}

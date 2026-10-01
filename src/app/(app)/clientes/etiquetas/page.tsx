import { Tag, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import EmptyState from "@/components/empty-state";
import { ESTILO_ETIQUETA, type CorEtiqueta } from "@/lib/clientes";
import { excluirEtiqueta } from "../segmentacao-actions";
import NovaEtiqueta from "./nova-etiqueta";

export default async function EtiquetasPage() {
  const supabase = await createClient();
  const [{ data: etiquetas }, { data: ligacoes }] = await Promise.all([
    supabase.from("labels").select("id, nome, cor").order("nome"),
    supabase.from("contact_labels").select("label_id").limit(20000),
  ]);
  const uso = new Map<string, number>();
  for (const l of ligacoes ?? []) uso.set(l.label_id, (uso.get(l.label_id) ?? 0) + 1);

  return (
    <div>
      <PageHeader icon={Tag} title="Etiquetas" subtitle="Marque clientes com etiquetas (VIP, alérgica, indicação...) e use nas campanhas." />
      <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
        <section className="card px-5 py-5">
          <h2 className="mb-3 text-[14px] font-extrabold">Nova etiqueta</h2>
          <NovaEtiqueta />
        </section>
        <section className="card overflow-hidden">
          {(etiquetas ?? []).length === 0 ? (
            <EmptyState icon={Tag} title="Nenhuma etiqueta ainda" text="Crie a primeira ao lado e aplique nos clientes pelo perfil de cada um." />
          ) : (
            <ul>
              {(etiquetas ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${ESTILO_ETIQUETA[(e.cor as CorEtiqueta) in ESTILO_ETIQUETA ? (e.cor as CorEtiqueta) : "cinza"]}`}>{e.nome}</span>
                    <span className="text-[12.5px] text-ink-soft">{uso.get(e.id) ?? 0} {(uso.get(e.id) ?? 0) === 1 ? "cliente" : "clientes"}</span>
                  </div>
                  <form action={excluirEtiqueta}>
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" aria-label={`Excluir etiqueta ${e.nome}`} title="Excluir" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-[#fdece9] hover:text-coral">
                      <Trash2 size={15} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ListChecks, Megaphone, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import EmptyState from "@/components/empty-state";
import { excluirLista } from "../segmentacao-actions";
import NovaLista from "./nova-lista";

export default async function ListasPage() {
  const supabase = await createClient();
  const [{ data: listas }, { data: membros }] = await Promise.all([
    supabase.from("contact_lists").select("id, nome, descricao, created_at").order("created_at", { ascending: false }),
    supabase.from("contact_list_members").select("list_id").limit(50000),
  ]);
  const total = new Map<string, number>();
  for (const m of membros ?? []) total.set(m.list_id, (total.get(m.list_id) ?? 0) + 1);

  return (
    <div>
      <PageHeader
        icon={ListChecks}
        title="Listas de clientes"
        subtitle="Grupos que você monta para campanhas: aniversariantes, clientes de um serviço, quem veio de uma indicação..."
        actions={
          <Link href="/campanhas/nova" className="btn btn-secondary btn-md">
            <Megaphone size={15} /> Criar campanha
          </Link>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
        <section className="card px-5 py-5">
          <h2 className="mb-3 text-[14px] font-extrabold">Nova lista</h2>
          <NovaLista />
          <p className="mt-4 text-[12px] leading-snug text-ink-soft">
            Para encher a lista: na <Link href="/clientes" className="font-bold text-purple hover:underline">Base de clientes</Link>, filtre por perfil (ex.: Em risco) e use &ldquo;Adicionar à lista&rdquo;, ou marque cliente a cliente no perfil dele.
          </p>
        </section>
        <section className="card overflow-hidden">
          {(listas ?? []).length === 0 ? (
            <EmptyState icon={ListChecks} title="Nenhuma lista ainda" text="Crie a primeira ao lado para usar como público de uma campanha." />
          ) : (
            <ul>
              {(listas ?? []).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-extrabold">{l.nome}</p>
                    <p className="truncate text-[12.5px] text-ink-soft">
                      {total.get(l.id) ?? 0} {(total.get(l.id) ?? 0) === 1 ? "cliente" : "clientes"}
                      {l.descricao ? ` · ${l.descricao}` : ""}
                    </p>
                  </div>
                  <form action={excluirLista}>
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" aria-label={`Excluir lista ${l.nome}`} title="Excluir (os clientes não são apagados)" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-[#fdece9] hover:text-coral">
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

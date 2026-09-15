import { createClient } from "@/lib/supabase/server";
import { criarContato } from "./actions";

const STAGES: { key: string; label: string }[] = [
  { key: "sem_contato", label: "Sem contato" },
  { key: "contato_feito", label: "Contato feito" },
  { key: "primeira_reuniao", label: "1ª conversa" },
  { key: "segunda_reuniao", label: "2ª conversa" },
  { key: "fechamento", label: "Fechamento" },
];

function formatTelefone(telefone: string) {
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 10) return telefone;
  const ddd = digits.slice(-11, -9);
  const resto = digits.slice(-9);
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

export default async function CrmPage() {
  const supabase = await createClient();

  const { data: contatos } = await supabase
    .from("contacts")
    .select("id, nome, telefone, tags, status_funil, created_at")
    .order("created_at", { ascending: false });

  const porEstagio = new Map<string, typeof contatos>();
  for (const stage of STAGES) porEstagio.set(stage.key, []);
  for (const contato of contatos ?? []) {
    const lista = porEstagio.get(contato.status_funil) ?? [];
    lista.push(contato);
    porEstagio.set(contato.status_funil, lista);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">CRM</h1>
          <p className="text-[13.5px] text-ink-soft">
            Funil de clientes — {contatos?.length ?? 0} contatos no total.
          </p>
        </div>

        <form action={criarContato} className="flex gap-2">
          <input
            name="nome"
            placeholder="Nome do cliente"
            required
            className="w-[160px] rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
          />
          <input
            name="telefone"
            placeholder="Telefone (WhatsApp)"
            required
            className="w-[170px] rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
          />
          <button
            type="submit"
            className="btn bg-ink px-4 py-2 text-[13px] text-white"
          >
            + Novo contato
          </button>
        </form>
      </div>

      <div className="flex gap-3.5 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const lista = porEstagio.get(stage.key) ?? [];
          return (
            <div key={stage.key} className="w-[230px] shrink-0">
              <div className="mb-2.5 flex items-center justify-between px-1">
                <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                  {stage.label}
                </p>
                <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                  {lista.length}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {lista.length === 0 ? (
                  <div className="card border-dashed px-3 py-6 text-center text-[12px] text-ink-faint">
                    Vazio
                  </div>
                ) : (
                  lista.map((contato) => (
                    <div key={contato.id} className="card px-3.5 py-3">
                      <p className="text-[13.5px] font-bold">
                        {contato.nome}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-faint">
                        {formatTelefone(contato.telefone)}
                      </p>
                      {contato.tags?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {contato.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="rounded-full bg-surface-soft px-2 py-0.5 text-[10.5px] font-bold text-ink-soft"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

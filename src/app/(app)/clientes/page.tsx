import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Filter, ListChecks, Search, Tag, Upload, UserRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import EmptyState from "@/components/empty-state";
import { ESTILO_ETIQUETA, SEGMENTOS_RFV, formatarTelefone, rotuloSegmento, type CorEtiqueta } from "@/lib/clientes";
import AdicionarALista from "./adicionar-a-lista";
import { carregarBase, mesAtualSP, mesDe } from "@/lib/clientes-dados";
import { brl } from "@/lib/relatorios";

const POR_PAGINA = 25;

type Filtro = "todos" | "aniversariantes" | "sem_aceite" | (typeof SEGMENTOS_RFV)[number]["id"];

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ seg?: string; q?: string; p?: string; etq?: string; lista?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (perfil?.role !== "dono") {
    return (
      <div>
        <PageHeader icon={Users} title="Clientes" />
        <div className="card">
          <EmptyState icon={Users} title="Só o dono do negócio vê a base de clientes completa" text="Você continua acessando o histórico de cada cliente pelas conversas e pela agenda." />
        </div>
      </div>
    );
  }

  const [base, { data: etiquetas }, { data: ligEtq }, { data: listas }, { data: membros }] = await Promise.all([
    carregarBase(supabase),
    supabase.from("labels").select("id, nome, cor").order("nome"),
    supabase.from("contact_labels").select("contact_id, label_id").limit(20000),
    supabase.from("contact_lists").select("id, nome").order("nome"),
    supabase.from("contact_list_members").select("list_id, contact_id").limit(50000),
  ]);
  const etqPorContato = new Map<string, string[]>();
  for (const l of ligEtq ?? []) etqPorContato.set(l.contact_id, [...(etqPorContato.get(l.contact_id) ?? []), l.label_id]);
  const etqInfo = new Map((etiquetas ?? []).map((e) => [e.id, e]));
  const etqFiltro = etiquetas?.some((e) => e.id === sp.etq) ? sp.etq : undefined;
  const listaFiltro = listas?.some((l) => l.id === sp.lista) ? sp.lista : undefined;
  const naLista = listaFiltro ? new Set((membros ?? []).filter((m) => m.list_id === listaFiltro).map((m) => m.contact_id)) : null;

  const mes = mesAtualSP();
  const contagem: Record<string, number> = {
    todos: base.length,
    aniversariantes: base.filter((c) => mesDe(c.nascimento) === mes).length,
    sem_aceite: base.filter((c) => !c.aceita).length,
  };
  for (const s of SEGMENTOS_RFV) contagem[s.id] = base.filter((c) => c.rfv.segmento === s.id).length;

  const filtros: { id: Filtro; label: string }[] = [
    { id: "todos", label: "Todos" },
    ...SEGMENTOS_RFV.map((s) => ({ id: s.id as Filtro, label: s.label })),
    { id: "aniversariantes", label: "Aniversariantes do mês" },
    { id: "sem_aceite", label: "Não recebem mensagens" },
  ];
  const seg = (filtros.some((f) => f.id === sp.seg) ? sp.seg : "todos") as Filtro;
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const qDigitos = q.replace(/\D/g, "");

  const filtrada = base.filter((c) => {
    if (seg === "aniversariantes" && mesDe(c.nascimento) !== mes) return false;
    if (seg === "sem_aceite" && c.aceita) return false;
    if (seg !== "todos" && seg !== "aniversariantes" && seg !== "sem_aceite" && c.rfv.segmento !== seg) return false;
    if (etqFiltro && !(etqPorContato.get(c.id) ?? []).includes(etqFiltro)) return false;
    if (naLista && !naLista.has(c.id)) return false;
    if (!q) return true;
    return c.nome.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q) || (qDigitos.length >= 3 && c.telefone.replace(/\D/g, "").includes(qDigitos));
  });

  const pagina = Math.max(1, Number(sp.p) || 1);
  const totalPaginas = Math.max(1, Math.ceil(filtrada.length / POR_PAGINA));
  const atual = Math.min(pagina, totalPaginas);
  const visiveis = filtrada.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { seg: seg === "todos" ? undefined : seg, q: sp.q, etq: etqFiltro, lista: listaFiltro, p: undefined, ...over } as Record<string, string | undefined>;
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const s = p.toString();
    return `/clientes${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Clientes"
        subtitle={`${base.length} ${base.length === 1 ? "cliente" : "clientes"} na sua base, organizados por quanto voltam e quanto gastam.`}
        actions={
          <>
            <a href="/relatorios/exportar?tipo=clientes&periodo=tudo&formato=xlsx" className="btn btn-secondary btn-md">
              <Download size={15} /> Exportar
            </a>
            <a href="/modelo-importacao-clientes.csv" download className="btn btn-secondary btn-md">
              <Download size={15} /> Baixar modelo de importação
            </a>
            <Link href="/clientes/importar" className="btn btn-primary btn-md">
              <Upload size={15} /> Importar planilha
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filtros.map((f) => (
          <Link
            key={f.id}
            href={link({ seg: f.id === "todos" ? undefined : f.id })}
            aria-current={seg === f.id ? "page" : undefined}
            title={SEGMENTOS_RFV.find((s) => s.id === f.id)?.dica}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
              seg === f.id ? "bg-ink-deep text-white" : "bg-surface text-ink-soft ring-1 ring-border hover:text-ink hover:ring-purple/40"
            }`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 text-[11px] ${seg === f.id ? "bg-white/20" : "bg-surface-soft"}`}>{contagem[f.id] ?? 0}</span>
          </Link>
        ))}
      </div>

      <form action="/clientes" className="mb-4 flex flex-wrap items-center gap-2">
        {seg !== "todos" && <input type="hidden" name="seg" value={seg} />}
        <div className="relative w-full max-w-[380px]">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por nome, telefone ou e-mail" className="input !pl-10" aria-label="Buscar clientes" />
        </div>
        {(etiquetas ?? []).length > 0 && (
          <select name="etq" defaultValue={etqFiltro ?? ""} aria-label="Filtrar por etiqueta" className="select !w-auto min-w-[150px]">
            <option value="">Todas as etiquetas</option>
            {(etiquetas ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        )}
        {(listas ?? []).length > 0 && (
          <select name="lista" defaultValue={listaFiltro ?? ""} aria-label="Filtrar por lista" className="select !w-auto min-w-[150px]">
            <option value="">Todas as listas</option>
            {(listas ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="btn btn-secondary btn-md">
          Filtrar
        </button>
        <span className="ml-auto flex gap-2">
          <Link href="/clientes/etiquetas" className="btn btn-ghost btn-sm">
            <Tag size={14} /> Etiquetas
          </Link>
          <Link href="/clientes/listas" className="btn btn-ghost btn-sm">
            <ListChecks size={14} /> Listas
          </Link>
        </span>
      </form>

      {filtrada.length > 0 && (
        <div className="mb-3">
          <AdicionarALista listas={listas ?? []} ids={filtrada.map((c) => c.id)} />
        </div>
      )}

      <div className="card overflow-hidden">
        {visiveis.length === 0 ? (
          base.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="Sua base de clientes está vazia"
              text="Os clientes aparecem aqui sozinhos quando conversam com o robô. Você também pode trazer a sua lista de uma planilha."
              action={{ href: "/clientes/importar", label: "Importar planilha" }}
            />
          ) : (
            <EmptyState icon={Filter} title="Nenhum cliente neste filtro" text="Tente outro perfil ou limpe a busca." action={{ href: "/clientes", label: "Ver todos" }} />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clean table-stack min-w-[760px]">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Perfil</th>
                  <th>Última visita</th>
                  <th className="num">Visitas</th>
                  <th className="num">Total gasto</th>
                  <th>Mensagens</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => {
                  const s = rotuloSegmento(c.rfv.segmento);
                  return (
                    <tr key={c.id} className="cursor-pointer">
                      <td>
                        <Link href={`/clientes/${c.id}`} className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ece9fc] text-[12.5px] font-extrabold text-purple">{c.nome.slice(0, 2).toUpperCase()}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13.5px] font-bold">{c.nome}</span>
                            <span className="block truncate text-[12px] text-ink-soft">{formatarTelefone(c.telefone)}</span>
                            {(etqPorContato.get(c.id) ?? []).length > 0 && (
                              <span className="mt-1 flex flex-wrap gap-1">
                                {(etqPorContato.get(c.id) ?? []).slice(0, 3).map((id) => {
                                  const e = etqInfo.get(id);
                                  if (!e) return null;
                                  return (
                                    <span key={id} className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${ESTILO_ETIQUETA[(e.cor as CorEtiqueta) in ESTILO_ETIQUETA ? (e.cor as CorEtiqueta) : "cinza"]}`}>
                                      {e.nome}
                                    </span>
                                  );
                                })}
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${s.badge}`}>{s.label}</span>
                      </td>
                      <td className="hide-sm text-[12.5px] text-ink-soft">
                        {c.ultimaVisita ? new Date(c.ultimaVisita).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
                      </td>
                      <td className="num hide-sm">{c.visitas}</td>
                      <td className="num font-semibold">{c.totalGasto > 0 ? brl.format(c.totalGasto) : "—"}</td>
                      <td>{c.aceita ? <span className="badge badge-success">Recebe</span> : <span className="badge badge-neutral">Não recebe</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[12.5px] text-ink-soft">
            <span>
              {(atual - 1) * POR_PAGINA + 1} a {Math.min(atual * POR_PAGINA, filtrada.length)} de {filtrada.length}
            </span>
            <div className="flex gap-1.5">
              {atual > 1 && (
                <Link href={link({ p: String(atual - 1) })} className="btn btn-secondary btn-sm">
                  <ChevronLeft size={14} /> Anterior
                </Link>
              )}
              {atual < totalPaginas && (
                <Link href={link({ p: String(atual + 1) })} className="btn btn-secondary btn-sm">
                  Próxima <ChevronRight size={14} />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

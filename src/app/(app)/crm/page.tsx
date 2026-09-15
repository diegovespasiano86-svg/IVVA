import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { criarContato } from "./actions";
import CrmBoard from "./board";
import StageManager from "./stage-manager";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function diasAteProximoAniversario(dataNascimento: string, hoje: Date) {
  const [, mes, dia] = dataNascimento.split("-").map(Number);
  let proximo = new Date(hoje.getFullYear(), mes - 1, dia);
  proximo.setHours(0, 0, 0, 0);
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (proximo < hojeSemHora) {
    proximo = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  }
  const diffMs = proximo.getTime() - hojeSemHora.getTime();
  return { dias: Math.round(diffMs / 86_400_000), data: proximo, mes: mes - 1, dia };
}

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const aba = view === "dashboard" ? "dashboard" : "funil";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const souDono = perfil?.role === "dono";

  const [{ data: estagios }, { data: contatos }] = await Promise.all([
    supabase
      .from("funnel_stages")
      .select("id, key, label, posicao")
      .order("posicao", { ascending: true }),
    supabase
      .from("contacts")
      .select(
        "id, nome, telefone, tags, status_funil, email, data_nascimento, estado_civil, como_conheceu, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const listaEstagios = estagios ?? [];
  const listaContatos = contatos ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">CRM</h1>
          <p className="text-[13.5px] text-ink-soft">
            Funil de clientes — {listaContatos.length} contatos no total.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {souDono && aba === "funil" && (
            <StageManager estagios={listaEstagios} />
          )}
          {aba === "funil" && (
            <form action={criarContato} className="flex gap-2">
              <input
                name="nome"
                placeholder="Nome do cliente"
                required
                className="w-[150px] rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
              />
              <input
                name="telefone"
                placeholder="Telefone (WhatsApp)"
                required
                className="w-[160px] rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
              />
              <button
                type="submit"
                className="btn bg-ink px-4 py-2 text-[13px] text-white"
              >
                + Novo contato
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        <Link
          href="/crm"
          className={`px-3.5 py-2 text-[13px] font-bold ${
            aba === "funil"
              ? "border-b-2 border-ink text-ink"
              : "text-ink-faint"
          }`}
        >
          Funil
        </Link>
        <Link
          href="/crm?view=dashboard"
          className={`px-3.5 py-2 text-[13px] font-bold ${
            aba === "dashboard"
              ? "border-b-2 border-ink text-ink"
              : "text-ink-faint"
          }`}
        >
          Dashboard
        </Link>
      </div>

      {aba === "funil" ? (
        <CrmBoard estagios={listaEstagios} contatosIniciais={listaContatos} />
      ) : (
        <CrmDashboard estagios={listaEstagios} contatos={listaContatos} />
      )}
    </div>
  );
}

function CrmDashboard({
  estagios,
  contatos,
}: {
  estagios: { key: string; label: string; posicao: number }[];
  contatos: {
    status_funil: string;
    data_nascimento: string | null;
    como_conheceu: string | null;
    nome: string;
  }[];
}) {
  const total = contatos.length;
  const porEstagio = estagios.map((e) => ({
    ...e,
    total: contatos.filter((c) => c.status_funil === e.key).length,
  }));
  const maiorPosicao = Math.max(0, ...estagios.map((e) => e.posicao));
  const ultimaFase = estagios.find((e) => e.posicao === maiorPosicao);
  const fechados = ultimaFase
    ? contatos.filter((c) => c.status_funil === ultimaFase.key).length
    : 0;
  const taxaConversao = total > 0 ? Math.round((fechados / total) * 100) : 0;

  const hoje = new Date();
  const aniversariantes = contatos
    .filter((c) => !!c.data_nascimento)
    .map((c) => ({
      nome: c.nome,
      ...diasAteProximoAniversario(c.data_nascimento as string, hoje),
    }))
    .filter((a) => a.dias <= 30)
    .sort((a, b) => a.dias - b.dias);

  const origens = new Map<string, number>();
  for (const c of contatos) {
    const chave = c.como_conheceu?.trim() || "Não informado";
    origens.set(chave, (origens.get(chave) ?? 0) + 1);
  }
  const origensOrdenadas = [...origens.entries()].sort((a, b) => b[1] - a[1]);
  const maiorOrigem = Math.max(1, ...origensOrdenadas.map(([, v]) => v));

  return (
    <div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Contatos no funil
          </p>
          <p className="font-display text-[26px] font-extrabold">{total}</p>
        </div>
        <div className="card border-purple/35 px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Taxa de conversão
          </p>
          <p className="font-display text-[26px] font-extrabold text-purple">
            {taxaConversao}%
          </p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            {ultimaFase?.label ?? "Última fase"}
          </p>
          <p className="font-display text-[26px] font-extrabold">{fechados}</p>
        </div>
        <div className="card border-teal/35 px-5 py-4.5">
          <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
            Aniversários em 30 dias
          </p>
          <p className="font-display text-[26px] font-extrabold text-teal">
            {aniversariantes.length}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3.5 md:grid-cols-2">
        <div className="card px-5 py-5">
          <p className="mb-4 text-[14px] font-bold">Funil por fase</p>
          {total === 0 ? (
            <p className="text-[12.5px] text-ink-faint">
              Sem contatos cadastrados ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {porEstagio.map((e) => (
                <div key={e.key}>
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold">{e.label}</span>
                    <span className="text-ink-faint">{e.total}</span>
                  </div>
                  <div className="h-[9px] w-full overflow-hidden rounded-full bg-surface-soft">
                    <div
                      className="h-full rounded-full bg-purple"
                      style={{
                        width: `${total > 0 ? Math.round((e.total / total) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card px-5 py-5">
          <p className="mb-4 text-[14px] font-bold">Como os clientes conheceram</p>
          {origensOrdenadas.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">Ainda sem dados.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {origensOrdenadas.map(([origem, qtd]) => (
                <div key={origem}>
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold">{origem}</span>
                    <span className="text-ink-faint">{qtd}</span>
                  </div>
                  <div className="h-[9px] w-full overflow-hidden rounded-full bg-surface-soft">
                    <div
                      className="h-full rounded-full bg-teal"
                      style={{ width: `${Math.round((qtd / maiorOrigem) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-3.5 px-5 py-5">
        <p className="mb-1 text-[14px] font-bold">Próximos aniversários</p>
        <p className="mb-4 text-[12px] text-ink-faint">
          Base pronta pra disparo automático de mensagem de aniversário.
        </p>
        {aniversariantes.length === 0 ? (
          <p className="rounded-[10px] bg-surface-soft px-4 py-6 text-center text-[13px] text-ink-faint">
            Nenhum aniversário nos próximos 30 dias — ou o campo ainda não foi
            preenchido nos cadastros.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {aniversariantes.map((a) => (
              <li
                key={`${a.nome}-${a.data.toISOString()}`}
                className="flex items-center justify-between rounded-[10px] border border-border px-4 py-3 text-[13.5px]"
              >
                <span className="font-semibold">{a.nome}</span>
                <span className="text-ink-soft">
                  {a.dias === 0
                    ? "Hoje"
                    : `${String(a.dia).padStart(2, "0")} ${MESES[a.mes]} · em ${a.dias}d`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adicionarNota,
  atualizarContato,
  alternarTarefaCrm,
  buscarHistorico,
  criarTarefaCrm,
  excluirTarefaCrm,
  listarTarefasContato,
  excluirContatoLgpd,
  moverContato,
} from "./actions";

export type Contato = {
  id: string;
  nome: string;
  telefone: string;
  tags: string[] | null;
  status_funil: string;
  email: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  como_conheceu: string | null;
  created_at: string;
};

export type Estagio = { id: string; key: string; label: string };

type Nota = {
  id: string;
  tipo: string;
  conteudo: string;
  created_at: string;
  autor: string | null;
};

const ESTADO_CIVIL_LABEL: Record<string, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  uniao_estavel: "União estável",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
};

function formatTelefone(telefone: string) {
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 10) return telefone;
  const ddd = digits.slice(-11, -9);
  const resto = digits.slice(-9);
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

function formatData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CrmBoard({
  estagios,
  contatosIniciais,
}: {
  estagios: Estagio[];
  contatosIniciais: Contato[];
}) {
  const router = useRouter();
  const [contatos, setContatos] = useState(contatosIniciais);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Contato | null>(null);
  const [modo, setModo] = useState<"cartoes" | "lista">("cartoes");
  const [, startTransition] = useTransition();

  const porEstagio = useMemo(() => {
    const mapa = new Map<string, Contato[]>();
    for (const e of estagios) mapa.set(e.key, []);
    for (const c of contatos) {
      const lista = mapa.get(c.status_funil) ?? [];
      lista.push(c);
      mapa.set(c.status_funil, lista);
    }
    return mapa;
  }, [estagios, contatos]);

  function moverParaEstagio(contactId: string, novoEstagio: string) {
    setContatos((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, status_funil: novoEstagio } : c,
      ),
    );
    startTransition(() => {
      moverContato(contactId, novoEstagio).then(() => router.refresh());
    });
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-ink-soft">
          {modo === "cartoes" ? "Arraste os cartões entre as fases. Clique para ver e preencher os detalhes." : "Todos os contatos e o que está preenchido. Clique numa linha para abrir os detalhes."}
        </p>
        <div className="inline-flex shrink-0 rounded-[10px] border border-border bg-surface p-0.5" role="group" aria-label="Modo de visualização">
          {(["cartoes", "lista"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              aria-pressed={modo === m}
              className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-bold ${modo === m ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
            >
              {m === "cartoes" ? "Cartões" : "Lista"}
            </button>
          ))}
        </div>
      </div>

      {modo === "lista" && (
        <div className="card overflow-x-auto">
          {contatos.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-faint">Nenhum contato ainda.</p>
          ) : (
            <table className="table-clean min-w-[820px]">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th>Aniversário</th>
                  <th>Fase</th>
                  <th>Como conheceu</th>
                  <th>Etiquetas</th>
                </tr>
              </thead>
              <tbody>
                {contatos.map((c) => (
                  <tr key={c.id} onClick={() => setSelecionado(c)} className="cursor-pointer hover:bg-surface-soft/60">
                    <td className="font-bold">{c.nome}</td>
                    <td>{formatTelefone(c.telefone)}</td>
                    <td>{c.email || "—"}</td>
                    <td>{c.data_nascimento ? c.data_nascimento.split("-").reverse().slice(0, 2).join("/") : "—"}</td>
                    <td>{estagios.find((e) => e.key === c.status_funil)?.label ?? c.status_funil}</td>
                    <td>{c.como_conheceu || "—"}</td>
                    <td>{c.tags && c.tags.length > 0 ? c.tags.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modo === "cartoes" && (
      <div className="flex gap-3.5 overflow-x-auto pb-2">
        {estagios.map((estagio) => {
          const lista = porEstagio.get(estagio.key) ?? [];
          const emFoco = colunaAlvo === estagio.key;
          return (
            <div
              key={estagio.id}
              className="w-[230px] shrink-0"
              onDragOver={(e) => {
                e.preventDefault();
                if (colunaAlvo !== estagio.key) setColunaAlvo(estagio.key);
              }}
              onDragLeave={() =>
                setColunaAlvo((atual) => (atual === estagio.key ? null : atual))
              }
              onDrop={(e) => {
                e.preventDefault();
                const contactId = e.dataTransfer.getData("text/plain");
                setColunaAlvo(null);
                setArrastando(null);
                if (contactId) moverParaEstagio(contactId, estagio.key);
              }}
            >
              <div className="mb-2.5 flex items-center justify-between px-1">
                <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                  {estagio.label}
                </p>
                <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                  {lista.length}
                </span>
              </div>

              <div
                className={`flex min-h-[70px] flex-col gap-2 rounded-[14px] p-1 transition-colors ${
                  emFoco ? "bg-purple/10" : ""
                }`}
              >
                {lista.length === 0 ? (
                  <div className="card border-dashed px-3 py-6 text-center text-[12px] text-ink-faint">
                    {emFoco ? "Solte aqui" : "Vazio"}
                  </div>
                ) : (
                  lista.map((contato) => (
                    <div
                      key={contato.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", contato.id);
                        e.dataTransfer.effectAllowed = "move";
                        setArrastando(contato.id);
                      }}
                      onDragEnd={() => {
                        setArrastando(null);
                        setColunaAlvo(null);
                      }}
                      onClick={() => setSelecionado(contato)}
                      className={`card cursor-grab px-3.5 py-3 active:cursor-grabbing ${
                        arrastando === contato.id ? "opacity-40" : ""
                      }`}
                    >
                      <p className="text-[13.5px] font-bold">{contato.nome}</p>
                      <p className="mt-0.5 text-[12px] text-ink-faint">
                        {formatTelefone(contato.telefone)}
                      </p>
                      {contato.tags && contato.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {contato.tags.map((tag) => (
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
      )}

      {selecionado && (
        <ContactDrawer
          key={selecionado.id}
          contato={selecionado}
          estagios={estagios}
          onFechar={() => setSelecionado(null)}
          onMover={(novoEstagio) => {
            moverParaEstagio(selecionado.id, novoEstagio);
            setSelecionado((c) =>
              c ? { ...c, status_funil: novoEstagio } : c,
            );
          }}
          onExcluido={() => {
            setContatos((prev) => prev.filter((c) => c.id !== selecionado.id));
            setSelecionado(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ContactDrawer({
  contato,
  estagios,
  onFechar,
  onMover,
  onExcluido,
}: {
  contato: Contato;
  estagios: Estagio[];
  onFechar: () => void;
  onMover: (novoEstagio: string) => void;
  onExcluido: () => void;
}) {
  const router = useRouter();
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoNota, setEnviandoNota] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const carregando = notas === null;

  async function confirmarExclusao() {
    if (textoConfirmacao.trim() !== contato.nome.trim()) return;
    setExcluindo(true);
    setErroExclusao(null);
    const formData = new FormData();
    formData.set("contact_id", contato.id);
    const resultado = await excluirContatoLgpd(formData);
    setExcluindo(false);
    if (resultado?.erro) {
      setErroExclusao(resultado.erro);
      return;
    }
    onExcluido();
  }

  useEffect(() => {
    let ativo = true;
    buscarHistorico(contato.id).then((r) => {
      if (ativo) setNotas(r);
    });
    return () => {
      ativo = false;
    };
  }, [contato.id]);

  async function salvarNota(formData: FormData) {
    setEnviandoNota(true);
    await adicionarNota(formData);
    const atualizado = await buscarHistorico(contato.id);
    setNotas(atualizado);
    setEnviandoNota(false);
  }

  async function salvarContato(formData: FormData) {
    setSalvando(true);
    await atualizarContato(formData);
    setSalvando(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onFechar}>
      <div
        className="flex h-full w-full max-w-[440px] flex-col overflow-y-auto bg-surface px-6 py-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-[19px] font-extrabold">
            {contato.nome}
          </h2>
          <button
            onClick={onFechar}
            className="rounded-full px-2 py-1 text-[13px] text-ink-faint hover:bg-surface-soft"
          >
            Fechar ✕
          </button>
        </div>

        <div className="mb-5">
          <label className="!mb-1.5">Fase no funil</label>
          <select
            defaultValue={contato.status_funil}
            onChange={(e) => onMover(e.target.value)}
            className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
          >
            {estagios.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11.5px] text-ink-faint">
            Também dá pra arrastar o card entre as colunas do funil.
          </p>
        </div>

        <form action={salvarContato} className="card flex flex-col gap-3 px-4 py-4">
          <input type="hidden" name="contact_id" value={contato.id} />
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-ink-faint">
            Dados do cliente
          </p>

          <div>
            <label htmlFor="nome">Nome</label>
            <input
              id="nome"
              name="nome"
              defaultValue={contato.nome}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="telefone">Telefone</label>
            <input
              id="telefone"
              name="telefone"
              defaultValue={contato.telefone}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={contato.email ?? ""}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="data_nascimento">Aniversário</label>
            <input
              id="data_nascimento"
              name="data_nascimento"
              type="date"
              defaultValue={contato.data_nascimento ?? ""}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="estado_civil">Estado civil</label>
            <select
              id="estado_civil"
              name="estado_civil"
              defaultValue={contato.estado_civil ?? ""}
              className="select"
            >
              <option value="">Não informado</option>
              {Object.entries(ESTADO_CIVIL_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="como_conheceu">Como conheceu</label>
            <input
              id="como_conheceu"
              name="como_conheceu"
              placeholder="Indicação, Instagram, passou na rua…"
              defaultValue={contato.como_conheceu ?? ""}
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="btn bg-ink px-4 py-2 text-[12.5px] text-white disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Salvar dados"}
          </button>
        </form>

        <TarefasDoContato contactId={contato.id} />

        <div className="mt-5">
          <p className="mb-2.5 text-[12.5px] font-bold uppercase tracking-wide text-ink-faint">
            Histórico e anotações
          </p>

          <form action={salvarNota} className="mb-3 flex gap-2">
            <input type="hidden" name="contact_id" value={contato.id} />
            <input
              name="conteudo"
              placeholder="Registrar o que foi conversado…"
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={enviandoNota}
              className="btn bg-purple px-3.5 py-2 text-[12.5px] text-white disabled:opacity-60"
            >
              {enviandoNota ? "…" : "Anotar"}
            </button>
          </form>

          {carregando ? (
            <p className="text-[12.5px] text-ink-faint">Carregando…</p>
          ) : !notas || notas.length === 0 ? (
            <p className="rounded-[10px] bg-surface-soft px-4 py-5 text-center text-[12.5px] text-ink-faint">
              Ainda sem histórico. Toda mudança de fase e anotação aparece
              aqui.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {notas.map((nota) => (
                <li
                  key={nota.id}
                  className={`rounded-[10px] border px-3.5 py-2.5 text-[12.5px] ${
                    nota.tipo === "mudanca_estagio"
                      ? "border-purple/25 bg-purple/5 text-ink-soft italic"
                      : "border-border bg-surface"
                  }`}
                >
                  <p>{nota.conteudo}</p>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {nota.autor ? `${nota.autor} · ` : ""}
                    {formatData(nota.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 border-t border-coral/20 pt-5">
          <p className="mb-1 text-[12.5px] font-bold uppercase tracking-wide text-coral">
            Zona de risco
          </p>
          <p className="mb-3 text-[12px] text-ink-faint">
            Apaga permanentemente este contato: dados pessoais, mensagens,
            agendamentos, notas, avaliações e o histórico de WhatsApp dele.
            Não pode ser desfeito.
          </p>

          {!confirmandoExclusao ? (
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(true)}
              className="rounded-[10px] border border-coral/40 px-3.5 py-2 text-[12.5px] font-semibold text-coral hover:bg-coral/5"
            >
              Apagar contato
            </button>
          ) : (
            <div className="rounded-[12px] border border-coral/30 bg-coral/5 px-4 py-4">
              <label htmlFor="confirmacao_exclusao" className="!text-coral">
                Pra confirmar, digite o nome do contato ({contato.nome})
              </label>
              <input
                id="confirmacao_exclusao"
                value={textoConfirmacao}
                onChange={(e) => setTextoConfirmacao(e.target.value)}
                autoFocus
                className="w-full rounded-[10px] border border-coral/40 bg-surface px-3 py-2 text-[13px]"
              />
              {erroExclusao && (
                <p role="alert" className="mt-2 text-[12.5px] font-semibold text-coral">
                  {erroExclusao}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmandoExclusao(false);
                    setTextoConfirmacao("");
                    setErroExclusao(null);
                  }}
                  className="rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarExclusao}
                  disabled={textoConfirmacao.trim() !== contato.nome.trim() || excluindo}
                  className="btn bg-coral px-3.5 py-2 text-[12.5px] text-white disabled:opacity-40"
                >
                  {excluindo ? "Apagando…" : "Apagar definitivamente"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type TarefaItem = Awaited<ReturnType<typeof listarTarefasContato>>[number];

function TarefasDoContato({ contactId }: { contactId: string }) {
  const [itens, setItens] = useState<TarefaItem[] | null>(null);
  const [tipo, setTipo] = useState<"tarefa" | "lembrete">("tarefa");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  async function recarregar() {
    setItens(await listarTarefasContato(contactId));
  }

  useEffect(() => {
    let ativo = true;
    listarTarefasContato(contactId).then((r) => {
      if (ativo) setItens(r);
    });
    return () => {
      ativo = false;
    };
  }, [contactId]);

  async function salvar(formData: FormData, form: HTMLFormElement) {
    setEnviando(true);
    setErro(null);
    const r = await criarTarefaCrm(formData);
    setEnviando(false);
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    form.reset();
    setTipo("tarefa");
    await recarregar();
  }

  async function alternar(t: TarefaItem) {
    await alternarTarefaCrm(t.id, t.status === "pendente");
    await recarregar();
  }

  async function apagar(t: TarefaItem) {
    await excluirTarefaCrm(t.id);
    await recarregar();
  }

  return (
    <div className="mt-5">
      <p className="mb-2.5 text-[12.5px] font-bold uppercase tracking-wide text-ink-faint">Tarefas e lembretes</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          salvar(new FormData(e.currentTarget), e.currentTarget);
        }}
        className="mb-3 flex flex-col gap-2 rounded-[12px] border border-border bg-surface-soft/50 p-3"
      >
        <input type="hidden" name="contact_id" value={contactId} />
        <div className="flex gap-2">
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "tarefa" | "lembrete")}
            className="select w-[120px]"
            aria-label="Tipo"
          >
            <option value="tarefa">Tarefa</option>
            <option value="lembrete">Lembrete</option>
          </select>
          <input type="date" name="data" required min={hoje} defaultValue={hoje} className="input flex-1" aria-label="Data" />
        </div>
        <input
          name="titulo"
          required
          maxLength={200}
          placeholder={tipo === "tarefa" ? "Ex.: ligar para o cliente e chamar para jantar" : "Ex.: mandar WhatsApp convidando para o evento"}
          className="input"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11.5px] text-ink-faint">No dia, o aviso aparece no topo do sistema.</p>
          <button type="submit" disabled={enviando} className="btn bg-purple px-3.5 py-2 text-[12.5px] text-white disabled:opacity-60">
            {enviando ? "…" : tipo === "tarefa" ? "Criar tarefa" : "Criar lembrete"}
          </button>
        </div>
        {erro && <p className="text-[12px] font-semibold text-coral">{erro}</p>}
      </form>

      {itens === null ? (
        <p className="text-[12.5px] text-ink-faint">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="rounded-[10px] bg-surface-soft px-4 py-4 text-center text-[12.5px] text-ink-faint">Nenhuma tarefa ou lembrete para este cliente.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map((t) => {
            const feita = t.status === "concluida";
            const atrasada = !feita && t.data < hoje;
            return (
              <li key={t.id} className="flex items-start gap-2.5 rounded-[10px] border border-border px-3 py-2.5 text-[12.5px]">
                <input type="checkbox" checked={feita} onChange={() => alternar(t)} className="mt-0.5 h-4 w-4" aria-label="Marcar como feita" />
                <div className="min-w-0 flex-1">
                  <p className={feita ? "text-ink-faint line-through" : "font-semibold"}>{t.titulo}</p>
                  <p className={`mt-0.5 text-[11.5px] ${atrasada ? "font-bold text-coral" : "text-ink-faint"}`}>
                    {t.tipo === "tarefa" ? "Tarefa" : "Lembrete"} · {t.data.split("-").reverse().join("/")}
                    {atrasada ? " · atrasada" : ""}
                  </p>
                </div>
                <button type="button" onClick={() => apagar(t)} className="text-[11.5px] text-ink-faint hover:text-coral" aria-label="Apagar">
                  Apagar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

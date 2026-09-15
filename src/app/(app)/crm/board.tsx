"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adicionarNota,
  atualizarContato,
  buscarHistorico,
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
}: {
  contato: Contato;
  estagios: Estagio[];
  onFechar: () => void;
  onMover: (novoEstagio: string) => void;
}) {
  const router = useRouter();
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoNota, setEnviandoNota] = useState(false);
  const carregando = notas === null;

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
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label htmlFor="telefone">Telefone</label>
            <input
              id="telefone"
              name="telefone"
              defaultValue={contato.telefone}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={contato.email ?? ""}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label htmlFor="data_nascimento">Aniversário</label>
            <input
              id="data_nascimento"
              name="data_nascimento"
              type="date"
              defaultValue={contato.data_nascimento ?? ""}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label htmlFor="estado_civil">Estado civil</label>
            <select
              id="estado_civil"
              name="estado_civil"
              defaultValue={contato.estado_civil ?? ""}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
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
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
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

        <div className="mt-5">
          <p className="mb-2.5 text-[12.5px] font-bold uppercase tracking-wide text-ink-faint">
            Histórico e anotações
          </p>

          <form action={salvarNota} className="mb-3 flex gap-2">
            <input type="hidden" name="contact_id" value={contato.id} />
            <input
              name="conteudo"
              placeholder="Registrar o que foi conversado…"
              className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
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
      </div>
    </div>
  );
}

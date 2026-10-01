"use client";

import { useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  Clock,
  CreditCard,
  Pencil,
  Plus,
  Scissors,
  Shapes,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CATEGORIAS, type CategoriaId } from "@/lib/blocos-conhecimento";
import { criarBloco, moverEntrada } from "./blocos-actions";
import { editarEntrada, removerEntrada } from "./actions";

const VISUAL: Record<CategoriaId, { icon: LucideIcon; cor: string }> = {
  servicos: { icon: Scissors, cor: "bg-[#ece9fc] text-purple" },
  precos: { icon: Tag, cor: "bg-[#e3f4ef] text-teal" },
  horarios: { icon: Clock, cor: "bg-[#e6eefc] text-blue" },
  pagamento: { icon: CreditCard, cor: "bg-[#e3f4ef] text-teal" },
  politicas: { icon: ShieldCheck, cor: "bg-[#fdf0dc] text-amber" },
  promocoes: { icon: Sparkles, cor: "bg-[#fdece9] text-coral" },
  equipe: { icon: Users, cor: "bg-[#ece9fc] text-purple" },
  faq: { icon: CircleHelp, cor: "bg-[#e6eefc] text-blue" },
  outros: { icon: Shapes, cor: "bg-surface-soft text-ink-soft" },
};

export type EntradaBloco = { id: string; conteudo: string };

function Linha({ e, categoria }: { e: EntradaBloco; categoria: string }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <form
        action={async (fd) => {
          await editarEntrada(fd);
          setEditando(false);
        }}
        className="flex flex-col gap-2 border-t border-border bg-bg px-5 py-3"
      >
        <input type="hidden" name="id" value={e.id} />
        <textarea
          name="conteudo"
          defaultValue={e.conteudo}
          required
          autoFocus
          rows={Math.min(8, Math.max(2, Math.ceil(e.conteudo.length / 80)))}
          className="resize-y rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditando(false)} className="btn btn-ghost btn-sm">
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            Salvar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="group flex items-start gap-3 border-t border-border px-5 py-3 transition-colors hover:bg-[#faf6ef]">
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed">{e.conteudo}</p>
      <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        <form action={moverEntrada} className="hidden sm:block">
          <input type="hidden" name="id" value={e.id} />
          <select
            name="categoria"
            defaultValue={categoria}
            aria-label="Mover para outro bloco"
            title="Mover para outro bloco"
            onChange={(ev) => ev.currentTarget.form?.requestSubmit()}
            className="h-7 rounded-md border border-transparent bg-transparent px-1 text-[11.5px] font-semibold text-ink-faint hover:border-border hover:bg-surface"
          >
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </form>
        <button type="button" onClick={() => setEditando(true)} title="Editar" aria-label="Editar" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-soft hover:text-ink">
          <Pencil size={14} />
        </button>
        <form action={removerEntrada}>
          <input type="hidden" name="id" value={e.id} />
          <button type="submit" title="Remover" aria-label="Remover" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-[#fdece9] hover:text-coral">
            <Trash2 size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BlocoCard({
  categoria,
  entradas,
  rotulo,
  dica,
}: {
  categoria: CategoriaId;
  entradas: EntradaBloco[];
  rotulo?: string;
  dica?: string;
}) {
  const base = CATEGORIAS.find((c) => c.id === categoria)!;
  const meta = { ...base, label: rotulo ?? base.label, dica: dica ?? base.dica };
  const { icon: Icon, cor } = VISUAL[categoria];
  const [aberto, setAberto] = useState(entradas.length > 0 && entradas.length <= 6);
  const [adicionando, setAdicionando] = useState(false);

  return (
    <section className="card overflow-hidden transition-shadow hover:shadow-[0_12px_32px_-16px_rgba(20,18,27,0.3)]">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cor}`}>
          <Icon size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-extrabold leading-tight">{meta.label}</span>
          <span className="block truncate text-[12px] text-ink-soft">{meta.dica}</span>
        </span>
        <span className={`badge ${entradas.length === 0 ? "badge-neutral" : "badge-brand"}`}>{entradas.length === 0 ? "vazio" : `${entradas.length} ${entradas.length === 1 ? "item" : "itens"}`}</span>
        <ChevronDown size={17} className={`shrink-0 text-ink-faint transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div>
          {entradas.length === 0 && !adicionando && (
            <p className="border-t border-border px-5 py-5 text-center text-[12.5px] text-ink-faint">Ainda não há nada neste bloco.</p>
          )}
          {entradas.map((e) => (
            <Linha key={e.id} e={e} categoria={categoria} />
          ))}

          <div className="border-t border-border bg-bg px-5 py-3">
            {adicionando ? (
              <form
                action={async (fd) => {
                  await criarBloco(fd);
                  setAdicionando(false);
                }}
                className="flex flex-col gap-2"
              >
                <input type="hidden" name="categoria" value={categoria} />
                <textarea
                  name="conteudo"
                  required
                  autoFocus
                  rows={2}
                  placeholder={`Escreva algo sobre ${meta.label.toLowerCase()}…`}
                  className="resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setAdicionando(false)} className="btn btn-ghost btn-sm">
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Adicionar
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setAdicionando(true)} className="btn btn-ghost btn-sm !px-2">
                <Plus size={15} /> Adicionar em {meta.label}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

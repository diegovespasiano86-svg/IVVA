"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { custoDaFicha, rotuloTipo } from "@/lib/catalogo";
import type { Termos } from "@/lib/termos";
import { criarItem, editarItem, movimentarEstoque, alternarAtivo, ajusteRapido, salvarFicha, type EstadoCatalogo } from "./actions";

export type ItemCatalogo = {
  id: string;
  tipo: "servico" | "venda" | "insumo";
  nome: string;
  categoria: string | null;
  preco: number;
  custo: number;
  controla_estoque: boolean;
  estoque_atual: number;
  estoque_minimo: number;
  duracao_minutos: number | null;
  ativo: boolean;
  /** Ficha técnica (só serviços): insumos que cada atendimento consome. */
  ficha?: { insumo_id: string; quantidade: number }[];
};

export type InsumoOpcao = { id: string; nome: string; custo: number };

const ESTADO: EstadoCatalogo = { erro: null };
const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Erro({ estado }: { estado: EstadoCatalogo }) {
  if (estado.erro) return <p role="alert" className="text-[12.5px] font-semibold text-coral">{estado.erro}</p>;
  return null;
}

export function NovoItem({ estoqueLiberado, termos }: { estoqueLiberado: boolean; termos: Termos }) {
  const [estado, acao, pendente] = useActionState(criarItem, ESTADO);
  const [tipo, setTipo] = useState<ItemCatalogo["tipo"]>("venda");
  const [controla, setControla] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) {
      ref.current?.reset();
      requestAnimationFrame(() => setControla(false));
    }
  }, [estado]);
  const podeEstoque = tipo !== "servico";

  return (
    <form ref={ref} action={acao} className="card mb-5 flex flex-col gap-3 px-4 py-4">
      <p className="text-[13.5px] font-bold">Novo item</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="n-tipo" className="!mb-1">Tipo</label>
          <select id="n-tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as ItemCatalogo["tipo"])} className="select w-[170px]">
            <option value="servico">{termos.servico}</option>
            <option value="venda">{rotuloTipo("venda", termos)}</option>
            <option value="insumo">Insumo de uso</option>
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label htmlFor="n-nome" className="!mb-1">Nome</label>
          <input id="n-nome" name="nome" required placeholder={tipo === "servico" ? "Limpeza de pele" : tipo === "venda" ? "Sérum vitamina C" : "Luva descartável"} className="input" />
        </div>
        <div>
          <label htmlFor="n-cat" className="!mb-1">Categoria</label>
          <input id="n-cat" name="categoria" placeholder="Facial" className="input w-[130px]" />
        </div>
        {tipo !== "insumo" && (
          <div>
            <label htmlFor="n-preco" className="!mb-1">Preço (R$)</label>
            <input id="n-preco" name="preco" type="number" step="0.01" min="0" placeholder="0,00" className="input w-[100px]" />
          </div>
        )}
        {tipo === "servico" && (
          <div>
            <label htmlFor="n-dur" className="!mb-1">Duração (min)</label>
            <input id="n-dur" name="duracao_minutos" type="number" min="5" step="5" placeholder="60" className="input w-[100px]" />
          </div>
        )}
        {podeEstoque && (
          <div>
            <label htmlFor="n-custo" className="!mb-1">Custo (R$)</label>
            <input id="n-custo" name="custo" type="number" step="0.01" min="0" placeholder="0,00" className="input w-[100px]" />
          </div>
        )}
      </div>

      {podeEstoque && (
        <div className="flex flex-wrap items-end gap-3 rounded-[12px] bg-surface-soft px-3.5 py-3">
          <label className={`flex items-center gap-2 text-[12.5px] font-semibold ${estoqueLiberado ? "" : "opacity-60"}`}>
            <input
              className="toggle"
              type="checkbox"
              name="controla_estoque"
              checked={controla && estoqueLiberado}
              disabled={!estoqueLiberado}
              onChange={(e) => setControla(e.target.checked)}
            />
            Controlar estoque deste item
          </label>
          {!estoqueLiberado && <span className="text-[11.5px] text-ink-faint">Disponível a partir do plano Profissional.</span>}
          {controla && estoqueLiberado && (
            <>
              <div>
                <label htmlFor="n-qtd" className="!mb-1">Quantidade atual</label>
                <input id="n-qtd" name="estoque_atual" type="number" min="0" placeholder="10" className="input w-[110px]" />
              </div>
              <div>
                <label htmlFor="n-min" className="!mb-1">Avisar quando restar</label>
                <input id="n-min" name="estoque_minimo" type="number" min="0" placeholder="3" className="input w-[110px]" />
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pendente} className="btn btn-primary btn-md disabled:opacity-60">
          {pendente ? "Salvando…" : "+ Adicionar ao catálogo"}
        </button>
        <Erro estado={estado} />
        {estado.ok && <span role="status" className="text-[12.5px] font-semibold text-teal">Item adicionado.</span>}
      </div>
    </form>
  );
}

function FormEditar({ item, estoqueLiberado, aoFechar }: { item: ItemCatalogo; estoqueLiberado: boolean; aoFechar: () => void }) {
  const [estado, acao, pendente] = useActionState(editarItem, ESTADO);
  useEffect(() => {
    if (estado.ok) aoFechar();
  }, [estado, aoFechar]);
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3 border-t border-border bg-surface-soft px-4 py-3">
      <input type="hidden" name="id" value={item.id} />
      <div className="min-w-[160px] flex-1">
        <label className="!mb-1">Nome</label>
        <input name="nome" defaultValue={item.nome} required className="input" />
      </div>
      <div>
        <label className="!mb-1">Categoria</label>
        <input name="categoria" defaultValue={item.categoria ?? ""} className="input w-[120px]" />
      </div>
      <div>
        <label className="!mb-1">Preço (R$)</label>
        <input name="preco" type="number" step="0.01" min="0" defaultValue={item.preco} className="input w-[100px]" />
      </div>
      {item.tipo !== "servico" && (
        <div>
          <label className="!mb-1">Custo (R$)</label>
          <input name="custo" type="number" step="0.01" min="0" defaultValue={item.custo} className="input w-[100px]" />
        </div>
      )}
      {item.tipo === "servico" && (
        <div>
          <label className="!mb-1">Duração (min)</label>
          <input name="duracao_minutos" type="number" min="5" step="5" defaultValue={item.duracao_minutos ?? ""} className="input w-[100px]" />
        </div>
      )}
      {item.tipo !== "servico" && (
        <>
          <label className={`flex items-center gap-2 text-[12.5px] font-semibold ${estoqueLiberado ? "" : "opacity-60"}`}>
            <input className="toggle" type="checkbox" name="controla_estoque" defaultChecked={item.controla_estoque} disabled={!estoqueLiberado} />
            Controlar estoque
          </label>
          <div>
            <label className="!mb-1">Avisar quando restar</label>
            <input name="estoque_minimo" type="number" min="0" defaultValue={item.estoque_minimo} className="input w-[110px]" />
          </div>
        </>
      )}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pendente} className="btn btn-primary btn-md disabled:opacity-60">{pendente ? "Salvando…" : "Salvar"}</button>
        <button type="button" onClick={aoFechar} className="btn btn-secondary btn-md">Cancelar</button>
      </div>
      <Erro estado={estado} />
    </form>
  );
}

function FormMovimento({ item, aoFechar }: { item: ItemCatalogo; aoFechar: () => void }) {
  const [estado, acao, pendente] = useActionState(movimentarEstoque, ESTADO);
  useEffect(() => {
    if (estado.ok) aoFechar();
  }, [estado, aoFechar]);
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3 border-t border-border bg-surface-soft px-4 py-3">
      <input type="hidden" name="id" value={item.id} />
      <div>
        <label className="!mb-1">O que aconteceu</label>
        <select name="tipo" defaultValue="entrada" className="select w-[190px]">
          <option value="entrada">Entrada (compra de mercadoria)</option>
          <option value="uso">Uso interno / procedimento</option>
          <option value="perda">Perda ou vencimento</option>
          <option value="ajuste">Ajuste de contagem (+ ou −)</option>
        </select>
      </div>
      <div>
        <label className="!mb-1">Quantidade</label>
        <input name="quantidade" type="number" required placeholder="5" className="input w-[100px]" />
      </div>
      <div className="min-w-[160px] flex-1">
        <label className="!mb-1">Motivo (opcional)</label>
        <input name="motivo" placeholder="Ex.: pedido do fornecedor" className="input" />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pendente} className="btn btn-primary btn-md disabled:opacity-60">{pendente ? "Salvando…" : "Registrar"}</button>
        <button type="button" onClick={aoFechar} className="btn btn-secondary btn-md">Cancelar</button>
      </div>
      <Erro estado={estado} />
    </form>
  );
}


function FichaPanel({ item, insumos, aoFechar }: { item: ItemCatalogo; insumos: InsumoOpcao[]; aoFechar: () => void }) {
  const [linhas, setLinhas] = useState<{ insumoId: string; quantidade: number }[]>(
    (item.ficha ?? []).map((f) => ({ insumoId: f.insumo_id, quantidade: f.quantidade })),
  );
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const disponiveis = insumos.filter((i) => !linhas.some((l) => l.insumoId === i.id));
  const custo = linhas.reduce((s, l) => s + l.quantidade * (insumos.find((i) => i.id === l.insumoId)?.custo ?? 0), 0);
  const margem = item.preco > 0 ? ((item.preco - custo) / item.preco) * 100 : 0;

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-surface-soft px-4 py-4">
      <div>
        <p className="text-[13px] font-bold">Ficha técnica: o que um atendimento de &ldquo;{item.nome}&rdquo; consome</p>
        <p className="text-[12px] text-ink-soft">Ao receber este serviço no Checkout, os insumos abaixo baixam do estoque sozinhos.</p>
      </div>
      {linhas.length === 0 && <p className="text-[12.5px] text-ink-faint">Nenhum insumo ainda. Adicione abaixo.</p>}
      <ul className="flex flex-col gap-2">
        {linhas.map((l) => {
          const ins = insumos.find((i) => i.id === l.insumoId);
          return (
            <li key={l.insumoId} className="anim-pop flex flex-wrap items-center gap-2 rounded-[10px] bg-surface px-3 py-2">
              <span className="min-w-[160px] flex-1 text-[13px] font-semibold">{ins?.nome ?? "Item removido"}</span>
              <label className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                Qtd. por atendimento
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={l.quantidade}
                  onChange={(e) => setLinhas((ls) => ls.map((x) => (x.insumoId === l.insumoId ? { ...x, quantidade: Math.max(1, Number(e.target.value) || 1) } : x)))}
                  className="input !w-[80px] shrink-0"
                />
              </label>
              <span className="w-[80px] text-right text-[12px] text-ink-faint">{dinheiro.format(l.quantidade * (ins?.custo ?? 0))}</span>
              <button type="button" aria-label="Remover insumo" onClick={() => setLinhas((ls) => ls.filter((x) => x.insumoId !== l.insumoId))} className="text-[18px] leading-none text-ink-faint hover:text-coral">×</button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Adicionar insumo"
          value=""
          onChange={(e) => e.target.value && setLinhas((ls) => [...ls, { insumoId: e.target.value, quantidade: 1 }])}
          className="select !w-[260px]"
          disabled={disponiveis.length === 0}
        >
          <option value="">{disponiveis.length === 0 ? "Cadastre insumos com estoque no catálogo" : "+ Adicionar insumo…"}</option>
          {disponiveis.map((i) => (
            <option key={i.id} value={i.id}>{i.nome}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-4 text-[12.5px]">
          <span>Custo de insumos: <strong>{dinheiro.format(custo)}</strong></span>
          {item.preco > 0 && <span className={margem >= 50 ? "text-teal" : margem >= 25 ? "text-ink-soft" : "text-coral"}>Margem sobre insumos: <strong>{margem.toFixed(0)}%</strong></span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await salvarFicha(item.id, linhas);
              if (r.erro) setErro(r.erro);
              else aoFechar();
            })
          }
          className="btn btn-primary btn-md disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar ficha"}
        </button>
        <button type="button" onClick={aoFechar} className="btn btn-secondary btn-md">Cancelar</button>
        {erro && <p role="alert" className="text-[12.5px] font-semibold text-coral">{erro}</p>}
      </div>
    </div>
  );
}

export function LinhaItem({ item, ehDono, estoqueLiberado, insumos, termos, indice = 0 }: { item: ItemCatalogo; ehDono: boolean; estoqueLiberado: boolean; insumos: InsumoOpcao[]; termos: Termos; indice?: number }) {
  const [painel, setPainel] = useState<"editar" | "movimento" | "ficha" | null>(null);
  const custoFicha = custoDaFicha(item.ficha, insumos);
  const fechar = () => setPainel(null);
  const baixo = item.controla_estoque && item.estoque_atual <= item.estoque_minimo;

  return (
    <li style={{ "--d": `${Math.min(indice, 12) * 30}ms` } as React.CSSProperties} className={`anim-rise border-b border-border last:border-0 ${item.ativo ? "" : "opacity-55"}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-[180px] flex-1">
          <p className="text-[13.5px] font-bold">{item.nome}{!item.ativo && <span className="ml-2 text-[11px] font-semibold text-ink-faint">(arquivado)</span>}</p>
          <p className="text-[11.5px] text-ink-faint">
            {rotuloTipo(item.tipo, termos)}{item.categoria ? ` · ${item.categoria}` : ""}{item.duracao_minutos ? ` · ${item.duracao_minutos} min` : ""}
            {item.tipo === "servico" && (item.ficha?.length ?? 0) > 0 && (
              <span className="ml-1.5 font-semibold text-teal">· usa {item.ficha!.length} {item.ficha!.length === 1 ? "insumo" : "insumos"} (custo {dinheiro.format(custoFicha)})</span>
            )}
            {item.tipo === "venda" && item.custo > 0 && item.preco > 0 && (
              <span className="ml-1.5 text-ink-faint">· margem {Math.round(((item.preco - item.custo) / item.preco) * 100)}%</span>
            )}
          </p>
        </div>
        <div className="w-[90px] text-right text-[13px] font-semibold">{item.tipo === "insumo" ? "—" : dinheiro.format(item.preco)}</div>
        <div className="flex w-[150px] items-center justify-end gap-1.5">
          {item.controla_estoque ? (
            <>
              <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${baixo ? "bg-coral/10 text-coral" : "bg-surface-soft text-ink-soft"}`}>{item.estoque_atual} un.</span>
              {estoqueLiberado && (
                <>
                  <form action={ajusteRapido}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="delta" value="-1" />
                    <button aria-label="Tirar 1 unidade" className="h-7 w-7 rounded-full border border-border text-[14px] hover:bg-surface-soft">−</button></form>
                  <form action={ajusteRapido}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="delta" value="1" />
                    <button aria-label="Adicionar 1 unidade" className="h-7 w-7 rounded-full border border-border text-[14px] hover:bg-surface-soft">+</button></form>
                </>
              )}
            </>
          ) : (
            <span className="text-[11.5px] text-ink-faint">sem controle</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {item.controla_estoque && estoqueLiberado && (
            <button type="button" onClick={() => setPainel(painel === "movimento" ? null : "movimento")} className="btn btn-secondary btn-sm">Movimentar</button>
          )}
          {ehDono && item.tipo === "servico" && estoqueLiberado && (
            <button type="button" onClick={() => setPainel(painel === "ficha" ? null : "ficha")} className="btn btn-secondary btn-sm">Ficha técnica</button>
          )}
          {ehDono && <button type="button" onClick={() => setPainel(painel === "editar" ? null : "editar")} className="btn btn-secondary btn-sm">Editar</button>}
          {ehDono && (
            <form action={alternarAtivo}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="ativo" value={item.ativo ? "false" : "true"} />
              <button className="btn btn-secondary btn-sm">{item.ativo ? "Arquivar" : "Reativar"}</button>
            </form>
          )}
        </div>
      </div>
      {painel === "editar" && <FormEditar item={item} estoqueLiberado={estoqueLiberado} aoFechar={fechar} />}
      {painel === "movimento" && <FormMovimento item={item} aoFechar={fechar} />}
      {painel === "ficha" && <FichaPanel item={item} insumos={insumos} aoFechar={fechar} />}
    </li>
  );
}

export function CopiarLista({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        } catch {
          /* sem permissão de área de transferência: o texto continua visível na tela */
        }
      }}
      className="btn btn-secondary btn-md"
    >
      {copiado ? "Copiado!" : "Copiar lista de compras"}
    </button>
  );
}

"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, MessageCircle, Plus, Search, Trash2, QrCode } from "lucide-react";
import { registrarPagamentoCarrinho, salvarPix, type RetornoCheckout } from "./actions";
import { gerarPixCopiaECola } from "@/lib/pix";
import type { Termos } from "@/lib/termos";

export type ContatoOpcao = { id: string; nome: string; telefone: string | null };
export type ProfissionalOpcao = { id: string; nome: string; comissao_pct: number };
export type ItemCatalogoCheckout = { id: string; tipo: "servico" | "venda"; nome: string; preco: number; controla: boolean; saldo: number };
export type PixConfig = { chave: string; beneficiario: string; cidade: string } | null;

type Linha = { key: number; productId: string | null; nome: string; qtd: number; preco: string; controla: boolean; saldo: number };

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const FORMAS = [
  { id: "pix", label: "Pix" },
  { id: "credito", label: "Crédito" },
  { id: "debito", label: "Débito" },
  { id: "dinheiro", label: "Dinheiro" },
] as const;

function tipoDaChave(chave: string): string {
  if (chave.includes("@")) return "email";
  if (chave.startsWith("+")) return "celular";
  if (chave.includes("-")) return "aleatoria";
  return "documento";
}

function ConfigurarPix({ aoSalvar }: { aoSalvar: () => void }) {
  const [estado, acao, pendente] = useActionState<RetornoCheckout, FormData>(salvarPix, { erro: null });
  useEffect(() => {
    if (estado.ok) aoSalvar();
  }, [estado, aoSalvar]);
  return (
    <form action={acao} className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface-soft px-4 py-4">
      <p className="text-[13px] font-bold">Configure o Pix da sua clínica (uma vez só)</p>
      <p className="text-[12px] text-ink-soft">O dinheiro cai direto na sua conta. O sistema gera o código Pix com o valor certo; você marca como recebido.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="!mb-1">Tipo da chave</label>
          <select name="tipo_chave" defaultValue="documento" className="select w-[150px]">
            <option value="documento">CPF ou CNPJ</option>
            <option value="celular">Celular</option>
            <option value="email">E-mail</option>
            <option value="aleatoria">Chave aleatória</option>
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="!mb-1">Chave Pix</label>
          <input name="chave" required className="input" autoComplete="off" />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="!mb-1">Nome de quem recebe</label>
          <input name="beneficiario" required maxLength={60} placeholder="Como aparece no banco" className="input" autoComplete="off" />
        </div>
        <div>
          <label className="!mb-1">Cidade</label>
          <input name="cidade" required maxLength={40} className="input w-[140px]" autoComplete="off" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pendente} className="btn btn-primary btn-md disabled:opacity-60">{pendente ? "Salvando…" : "Salvar Pix"}</button>
        {estado.erro && <p role="alert" className="text-[12.5px] font-semibold text-coral">{estado.erro}</p>}
      </div>
    </form>
  );
}


function AdicionarItem({ catalogo, aoEscolher, placeholder }: { catalogo: ItemCatalogoCheckout[]; aoEscolher: (id: string) => void; placeholder: string }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtrados = catalogo.filter((c) => norm(c.nome).includes(norm(busca))).slice(0, 12);
  return (
    <div className="relative w-[260px]" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        value={busca}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        placeholder={placeholder}
        aria-label="Buscar no catálogo"
        className="input !pl-9"
      />
      {aberto && (
        <ul className="anim-pop absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[300px] overflow-auto rounded-[14px] border border-border bg-surface p-1.5 shadow-[0_18px_40px_-18px_rgba(36,31,46,0.35)]">
          {filtrados.length === 0 ? (
            <li className="px-3 py-3 text-[12.5px] text-ink-faint">Nada encontrado. Use &ldquo;Item avulso&rdquo;.</li>
          ) : (
            filtrados.map((c) => {
              const semSaldo = c.tipo === "venda" && c.controla && c.saldo <= 0;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={semSaldo}
                    onClick={() => { aoEscolher(c.id); setBusca(""); setAberto(false); }}
                    className="flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] hover:bg-surface-soft disabled:opacity-50"
                  >
                    <span>
                      <span className="block font-semibold">{c.nome}</span>
                      <span className="block text-[11px] text-ink-faint">{c.tipo === "servico" ? "Serviço" : "Produto"}{c.controla ? ` · ${semSaldo ? "sem estoque" : c.saldo + " em estoque"}` : ""}</span>
                    </span>
                    <span className="font-bold">{dinheiro.format(c.preco)}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default function CheckoutForm({
  contatos,
  profissionais,
  catalogo,
  prefill,
  temComissao,
  pix: pixConfig,
  ehDono,
  termos,
}: {
  contatos: ContatoOpcao[];
  profissionais: ProfissionalOpcao[];
  catalogo: ItemCatalogoCheckout[];
  prefill: { appointmentId?: string; contactId?: string; professionalId?: string; servico?: string };
  temComissao: boolean;
  pix: PixConfig;
  ehDono: boolean;
  termos: Termos;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const proximaChave = useMemo(() => ({ n: 1 }), []);

  const itemInicial = (): Linha[] => {
    if (!prefill.servico) return [];
    const doCatalogo = catalogo.find((c) => c.nome.toLowerCase() === prefill.servico!.toLowerCase());
    return [{ key: 0, productId: doCatalogo?.id ?? null, nome: prefill.servico, qtd: 1, preco: doCatalogo ? String(doCatalogo.preco) : "", controla: false, saldo: 0 }];
  };

  const [contactId, setContactId] = useState(prefill.contactId ?? "");
  const [novoCliente, setNovoCliente] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [telNovo, setTelNovo] = useState("");
  const [profissional, setProfissional] = useState(prefill.professionalId ?? "");
  const [linhas, setLinhas] = useState<Linha[]>(itemInicial);
  const [desconto, setDesconto] = useState("");
  const [forma, setForma] = useState("");
  const [pixAberto, setPixAberto] = useState(false);
  const [txid, setTxid] = useState("");
  const [configurando, setConfigurando] = useState(false);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [retorno, setRetorno] = useState<{ ok: boolean; texto: string } | null>(null);

  const bruto = linhas.reduce((s, l) => s + l.qtd * (Number(l.preco) || 0), 0);
  const valorDesconto = Math.min(Number(desconto) || 0, bruto);
  const total = Math.max(0, Math.round((bruto - valorDesconto) * 100) / 100);
  const contato = contatos.find((c) => c.id === contactId);

  const payloadPix = useMemo(
    () =>
      pixConfig && total > 0
        ? gerarPixCopiaECola({ chave: pixConfig.chave, beneficiario: pixConfig.beneficiario, cidade: pixConfig.cidade, valor: total, txid })
        : "",
    [pixConfig, total, txid],
  );

  useEffect(() => {
    let cancelado = false;
    if (pixAberto && payloadPix) QRCode.toDataURL(payloadPix, { margin: 1, width: 220 }).then((url) => !cancelado && setQr(url));
    return () => {
      cancelado = true;
    };
  }, [pixAberto, payloadPix]);

  const adicionarDoCatalogo = (id: string) => {
    const c = catalogo.find((x) => x.id === id);
    if (!c) return;
    setLinhas((ls) => {
      const existente = ls.find((l) => l.productId === id);
      if (existente) return ls.map((l) => (l.productId === id ? { ...l, qtd: l.qtd + 1 } : l));
      return [...ls, { key: proximaChave.n++, productId: c.id, nome: c.nome, qtd: 1, preco: String(c.preco), controla: c.controla, saldo: c.saldo }];
    });
  };
  const adicionarAvulso = () => setLinhas((ls) => [...ls, { key: proximaChave.n++, productId: null, nome: "", qtd: 1, preco: "", controla: false, saldo: 0 }]);
  const mudar = (key: number, parte: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...parte } : l)));

  const limpar = () => {
    setLinhas([]);
    setDesconto("");
    setForma("");
    setPixAberto(false);
    setContactId("");
    setNovoCliente(false);
    setNomeNovo("");
    setTelNovo("");
    setQr("");
  };

  const validar = (): string | null => {
    if (!contactId && !(novoCliente && nomeNovo.trim() && telNovo.trim())) return `Escolha o ${termos.cliente.toLowerCase()} ou cadastre um novo (nome e WhatsApp).`;
    if (linhas.length === 0) return "Adicione pelo menos um item.";
    if (linhas.some((l) => !l.nome.trim())) return "Todo item precisa de um nome.";
    if (total <= 0) return "O total precisa ser maior que zero.";
    if (!forma) return "Escolha a forma de pagamento.";
    return null;
  };

  const registrar = () => {
    const erro = validar();
    if (erro) return setRetorno({ ok: false, texto: erro });
    setRetorno(null);
    iniciar(async () => {
      const r = await registrarPagamentoCarrinho({
        contactId: contactId || null,
        novoCliente: !contactId ? { nome: nomeNovo, telefone: telNovo } : null,
        professionalId: profissional,
        appointmentId: prefill.appointmentId ?? null,
        itens: linhas.map((l) => ({ productId: l.productId, nome: l.nome.trim(), qtd: l.qtd, preco: Number(l.preco) || 0 })),
        forma,
        desconto: valorDesconto,
      });
      if (r.erro) setRetorno({ ok: false, texto: r.erro });
      else {
        setRetorno({ ok: true, texto: `Pagamento de ${dinheiro.format(total)} registrado.` });
        limpar();
        router.replace("/checkout");
        router.refresh();
      }
    });
  };

  const aoEscolherForma = (id: string) => {
    setForma(id);
    setPixAberto(false);
    setRetorno(null);
  };

  const telefoneWa = (contato?.telefone ?? telNovo).replace(/\D/g, "");
  const textoWa = `Olá! Segue o Pix de ${dinheiro.format(total)}. Copie e cole no app do seu banco:\n\n${payloadPix}`;

  return (
    <div className="card mb-5 flex flex-col gap-5 px-4 py-4 sm:px-5">
      {retorno && (
        <p role={retorno.ok ? "status" : "alert"} className={`anim-pop flex items-center gap-2.5 rounded-[12px] px-4 py-3 text-[13.5px] font-semibold ${retorno.ok ? "bg-teal/10 text-teal" : "bg-coral/10 text-coral"}`}>
          {retorno.ok && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal text-white">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className="anim-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
          )}
          {retorno.texto}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="co-cliente" className="!mb-0">{termos.cliente}</label>
            <button type="button" onClick={() => { setNovoCliente(!novoCliente); setContactId(""); }} className="text-[12px] font-bold text-purple hover:underline">
              {novoCliente ? "Escolher da lista" : `+ Novo ${termos.cliente.toLowerCase()}`}
            </button>
          </div>
          {novoCliente ? (
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Nome do novo cliente" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome" className="input" />
              <input aria-label="WhatsApp do novo cliente" value={telNovo} onChange={(e) => setTelNovo(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" className="input" />
            </div>
          ) : (
            <select id="co-cliente" value={contactId} onChange={(e) => setContactId(e.target.value)} className="select w-full">
              <option value="">Selecione…</option>
              {contatos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label htmlFor="co-prof" className="!mb-1">{termos.profissional}</label>
          <select id="co-prof" value={profissional} onChange={(e) => setProfissional(e.target.value)} className="select w-full">
            <option value="">Nenhum (sem comissão)</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>{temComissao ? `${p.nome} (${p.comissao_pct}%)` : p.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13.5px] font-bold">Itens da venda</p>
          <div className="flex flex-wrap items-center gap-2">
            {catalogo.length > 0 && <AdicionarItem catalogo={catalogo} aoEscolher={adicionarDoCatalogo} placeholder={`Buscar ${termos.servico.toLowerCase()} ou ${termos.produto.toLowerCase()}…`} />}
            <button type="button" onClick={adicionarAvulso} className="btn btn-secondary btn-md"><Plus size={15} /> Item avulso</button>
          </div>
        </div>

        {linhas.length === 0 ? (
          <p className="rounded-[12px] bg-surface-soft px-4 py-6 text-center text-[13px] text-ink-faint">
            Adicione os itens desta venda ou atendimento. {catalogo.length === 0 && "Cadastre-os no Catálogo ou use um item avulso."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {linhas.map((l) => (
              <li key={l.key} className="anim-pop flex flex-wrap items-center gap-2 rounded-[12px] border border-border px-3 py-2.5">
                {l.productId ? (
                  <span className="min-w-[160px] flex-1 text-[13.5px] font-semibold">{l.nome}{l.controla && <span className="ml-2 text-[11px] font-normal text-ink-faint">{l.saldo} em estoque</span>}</span>
                ) : (
                  <input aria-label="Nome do item" value={l.nome} onChange={(e) => mudar(l.key, { nome: e.target.value })} placeholder="Nome do serviço ou produto" className="input min-w-[160px] flex-1" />
                )}
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Diminuir quantidade" onClick={() => mudar(l.key, { qtd: Math.max(1, l.qtd - 1) })} className="h-7 w-7 rounded-full border border-border hover:bg-surface-soft">−</button>
                  <span className="w-6 text-center text-[13px] font-bold">{l.qtd}</span>
                  <button type="button" aria-label="Aumentar quantidade" onClick={() => mudar(l.key, { qtd: l.qtd + 1 })} className="h-7 w-7 rounded-full border border-border hover:bg-surface-soft">+</button>
                </div>
                <input aria-label="Preço unitário" type="number" step="0.01" min="0" value={l.preco} onChange={(e) => mudar(l.key, { preco: e.target.value })} placeholder="0,00" className="input !w-[100px] shrink-0" />
                <span className="w-[86px] text-right text-[13px] font-bold">{dinheiro.format(l.qtd * (Number(l.preco) || 0))}</span>
                <button type="button" aria-label="Remover item" onClick={() => setLinhas((ls) => ls.filter((x) => x.key !== l.key))} className="text-ink-faint hover:text-coral"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-[12.5px] font-bold">Forma de pagamento</p>
            <div className="flex flex-wrap gap-2">
              {FORMAS.map((f) => (
                <button key={f.id} type="button" aria-pressed={forma === f.id} onClick={() => aoEscolherForma(f.id)}
                  className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ${forma === f.id ? "border-purple bg-purple/10 text-purple" : "border-border text-ink-soft hover:border-ink/30"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-[160px]">
            <label htmlFor="co-desc" className="!mb-1">Desconto (R$)</label>
            <input id="co-desc" type="number" step="0.01" min="0" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" className="input" />
          </div>
        </div>
        <div className="flex flex-col items-end justify-between gap-3">
          <div className="text-right">
            {valorDesconto > 0 && <p className="text-[12px] text-ink-faint">Subtotal {dinheiro.format(bruto)} · desconto −{dinheiro.format(valorDesconto)}</p>}
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Total</p>
            <p key={total} className="anim-flash font-display text-[28px] font-extrabold text-teal">{dinheiro.format(total)}</p>
          </div>
          {forma === "pix" && !pixAberto ? (
            <button type="button" disabled={pendente} onClick={() => { const e = validar(); if (e) return setRetorno({ ok: false, texto: e }); setRetorno(null); if (!pixConfig) setConfigurando(true); setTxid("IVVA" + Date.now().toString(36).toUpperCase()); setPixAberto(true); }} className="btn btn-primary btn-md disabled:opacity-60">
              <QrCode size={16} /> Gerar Pix
            </button>
          ) : forma !== "pix" ? (
            <button type="button" disabled={pendente} onClick={registrar} className="btn btn-primary btn-md disabled:opacity-60">
              {pendente ? "Registrando…" : "Registrar pagamento"}
            </button>
          ) : null}
        </div>
      </div>

      {forma === "pix" && pixAberto && (
        <div className="rounded-[14px] border border-border px-4 py-4">
          {!pixConfig || configurando ? (
            ehDono ? (
              <ConfigurarPix aoSalvar={() => { setConfigurando(false); router.refresh(); }} />
            ) : (
              <p className="text-[13px] text-ink-soft">O administrador ainda não configurou o Pix da clínica. Peça para ele cadastrar a chave em Checkout.</p>
            )
          ) : (
            <div className="flex flex-wrap items-start gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="QR Code do Pix" width={170} height={170} className="rounded-[12px] border border-border" />}
              <div className="min-w-[240px] flex-1">
                <p className="text-[13.5px] font-bold">Peça para o cliente escanear ou copiar o código</p>
                <p className="mt-0.5 text-[12px] text-ink-soft">Valor {dinheiro.format(total)} · recebe {pixConfig.beneficiario}</p>
                <textarea readOnly value={payloadPix} rows={3} className="textarea mt-2 text-[11.5px]" onFocus={(e) => e.currentTarget.select()} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(payloadPix); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* o cliente copia manualmente */ } }} className="btn btn-secondary btn-md">
                    <Copy size={15} /> {copiado ? "Copiado!" : "Copiar código"}
                  </button>
                  {telefoneWa.length >= 10 && (
                    <a href={`https://wa.me/${telefoneWa.startsWith("55") ? telefoneWa : "55" + telefoneWa}?text=${encodeURIComponent(textoWa)}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-md">
                      <MessageCircle size={15} /> Enviar pelo WhatsApp
                    </a>
                  )}
                  {ehDono && <button type="button" onClick={() => setConfigurando(true)} className="btn btn-secondary btn-md">Trocar chave</button>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <button type="button" disabled={pendente} onClick={registrar} className="btn btn-primary btn-md disabled:opacity-60">{pendente ? "Registrando…" : "Pix recebido — registrar pagamento"}</button>
                  <button type="button" onClick={() => setPixAberto(false)} className="btn btn-secondary btn-md">Voltar</button>
                </div>
                <p className="mt-2 text-[11.5px] text-ink-faint">O Pix cai direto na sua conta. Confirme no app do seu banco antes de registrar.</p>
              </div>
            </div>
          )}
        </div>
      )}
      {pixConfig && <span className="sr-only">Pix {tipoDaChave(pixConfig.chave)}</span>}
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Link2, MessageCircle, QrCode } from "lucide-react";
import { criarCobrancaAsaas, statusCobranca, type CobrancaCriada } from "./asaas-actions";
import type { DadosPagamento } from "./actions";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Cobrança pelo Asaas: gera Pix QR Code ou link (Pix/cartão), acompanha o pagamento e, quando o Asaas avisa, a venda já está registrada. */
export default function CobrarAsaas({
  montarDados,
  validar,
  telefone,
  aoPagar,
}: {
  montarDados: () => Omit<DadosPagamento, "forma">;
  validar: () => string | null;
  telefone: string;
  aoPagar: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [cobranca, setCobranca] = useState<CobrancaCriada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<"aguardando" | "paga" | "sem_registro">("aguardando");
  const [copiado, setCopiado] = useState(false);

  // Consulta a situação a cada 4 segundos enquanto a cobrança está aberta.
  useEffect(() => {
    if (!cobranca || situacao !== "aguardando") return;
    const t = setInterval(async () => {
      const s = await statusCobranca(cobranca.id);
      if (s.status === "paga") {
        setSituacao("paga");
        aoPagar();
      } else if (s.status === "paga_sem_registro") setSituacao("sem_registro");
    }, 4000);
    return () => clearInterval(t);
  }, [cobranca, situacao, aoPagar]);

  const gerar = (modo: "pix" | "link") => {
    const e = validar();
    if (e) return setErro(e);
    setErro(null);
    iniciar(async () => {
      const r = await criarCobrancaAsaas(montarDados(), modo);
      if (r.erro || !r.cobranca) return setErro(r.erro ?? "Não consegui gerar a cobrança.");
      setSituacao("aguardando");
      setCobranca(r.cobranca);
    });
  };

  const tel = telefone.replace(/\D/g, "");
  const texto = cobranca
    ? cobranca.modo === "pix"
      ? `Olá! Segue o Pix de ${dinheiro.format(cobranca.valor)}. Copie e cole no app do seu banco:\n\n${cobranca.copiaECola}`
      : `Olá! Segue o link para pagar ${dinheiro.format(cobranca.valor)} por Pix ou cartão: ${cobranca.url}`
    : "";
  const copiavel = cobranca?.copiaECola ?? cobranca?.url ?? "";

  return (
    <div className="rounded-[14px] border border-border px-4 py-4">
      <p className="text-[13.5px] font-bold">Cobrar pelo Asaas</p>
      <p className="mt-0.5 text-[12px] text-ink-soft">Cai na sua conta Asaas e a venda é registrada sozinha quando o pagamento for confirmado (estoque, comissão e relatórios).</p>

      {!cobranca && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={pendente} onClick={() => gerar("pix")} className="btn btn-primary btn-md disabled:opacity-60">
            <QrCode size={16} /> {pendente ? "Gerando…" : "Pix QR Code"}
          </button>
          <button type="button" disabled={pendente} onClick={() => gerar("link")} className="btn btn-secondary btn-md disabled:opacity-60">
            <Link2 size={16} /> Link (Pix ou cartão)
          </button>
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-[13px] font-semibold text-coral">{erro}</p>}

      {cobranca && (
        <div className="mt-3 flex flex-wrap items-start gap-5">
          {cobranca.imagem && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${cobranca.imagem}`} alt="QR Code do Pix" width={170} height={170} className="rounded-[12px] border border-border" />
          )}
          <div className="min-w-[240px] flex-1">
            {situacao === "paga" ? (
              <p role="status" className="rounded-[12px] bg-teal/10 px-4 py-3 text-[14px] font-bold text-teal">Pagamento de {dinheiro.format(cobranca.valor)} confirmado e registrado.</p>
            ) : situacao === "sem_registro" ? (
              <p role="alert" className="rounded-[12px] bg-coral/10 px-4 py-3 text-[13px] font-semibold text-coral">
                O pagamento de {dinheiro.format(cobranca.valor)} foi confirmado no Asaas, mas a baixa automática falhou (provavelmente falta de estoque). Registre a venda manualmente no Checkout.
              </p>
            ) : (
              <>
                <p className="text-[13.5px] font-bold">Aguardando o pagamento de {dinheiro.format(cobranca.valor)}…</p>
                <p className="mt-0.5 text-[12px] text-ink-soft">{cobranca.modo === "pix" ? "Peça para o cliente escanear ou copiar o código." : "Envie o link ao cliente; ele escolhe Pix ou cartão."}</p>
                <textarea readOnly value={copiavel} rows={3} className="textarea mt-2 text-[11.5px]" onFocus={(e) => e.currentTarget.select()} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(copiavel); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* copia manualmente */ } }} className="btn btn-secondary btn-md">
                    <Copy size={15} /> {copiado ? "Copiado!" : "Copiar"}
                  </button>
                  {tel.length >= 10 && (
                    <a href={`https://wa.me/${tel.startsWith("55") ? tel : "55" + tel}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-md">
                      <MessageCircle size={15} /> Enviar pelo WhatsApp
                    </a>
                  )}
                </div>
              </>
            )}
            <button type="button" onClick={() => { setCobranca(null); setSituacao("aguardando"); }} className="mt-3 text-[12px] font-bold text-purple">
              {situacao === "aguardando" ? "Cancelar e voltar" : "Nova cobrança"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

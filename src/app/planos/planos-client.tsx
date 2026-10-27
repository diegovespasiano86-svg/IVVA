"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { iniciarCadastro, iniciarCadastroPix, situacaoPix, type CadastroPixState, type CadastroState } from "./actions";
import { SEGMENTOS } from "@/lib/segmentos";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

type Plano = {
  key: string;
  nome: string;
  preco: number;
  conversas: number;
  descricao: string;
  destaque?: boolean;
  recursos: string[];
};

// Volumes de conversas por mês para o visitante achar o plano certo.
const VOLUMES = [150, 300, 700, 1500];

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

// Ciclo anual: 10 mensalidades (2 meses grátis).
const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const totalAnual = (p: Plano) => p.preco * 10;

const ESTADO_INICIAL: CadastroState = { erro: null, clientSecret: null };
const ESTADO_INICIAL_PIX: CadastroPixState = { erro: null, ref: null, pix: null, valor: null };

type PixPronto = { ref: string; copiaECola: string; imagem: string; valor: number };

// Cartão do plano: só escolhe o plano. Os dados do cliente são pedidos na etapa seguinte (CadastroPanel),
// ANTES do pagamento, para que quem desistir no meio fique registrado.
function CardForm({ destaque, onEscolher, onEscolherPix }: { destaque?: boolean; onEscolher: () => void; onEscolherPix?: () => void }) {
  return (
    <div className="mt-6 flex flex-col gap-2">
      <button
        type="button"
        onClick={onEscolher}
        className={`rounded-full py-3 text-[13.5px] font-semibold transition-shadow ${
          destaque
            ? "bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)] hover:shadow-[0_14px_40px_-8px_rgba(139,127,232,0.85)]"
            : "bg-[#0e0e13] text-white hover:bg-[#23222c]"
        }`}
      >
        Assinar
      </button>
      <p className={`text-center text-[11.5px] ${destaque ? "text-[#a5a3b0]" : "text-[#8a8896]"}`}>
        14 dias grátis. Cancele quando quiser.
      </p>
      {onEscolherPix && (
        <button
          type="button"
          onClick={onEscolherPix}
          className={`text-center text-[12.5px] font-semibold underline-offset-2 hover:underline ${destaque ? "text-[#2fbf9f]" : "text-[#1f9a7f]"}`}
        >
          Prefere Pix? Assine pagando no Pix
        </button>
      )}
    </div>
  );
}

const CAMPO =
  "w-full rounded-xl border border-[rgba(14,14,19,0.16)] bg-white px-4 py-2.5 text-[14px] text-[#0e0e13] outline-none placeholder:text-[#8a8896] focus:ring-2 focus:ring-[#2fbf9f]";
const ROTULO = "mb-1 block text-[12.5px] font-bold text-[#0e0e13]";

/** Presentes da janela de saída do site (Rescue). Chegam como ?presente=... e ficam guardados com a origem. */
export const PRESENTES: Record<string, string> = {
  desconto10: "Seu presente: 10% de desconto na primeira mensalidade (no cartão, plano mensal).",
  upgrade: "Seu presente: 30 dias do plano acima pelo preço do seu, liberados quando a sua conta for criada.",
  implantacao: "Seu presente: a equipe ivva configura o robô com você. Vamos te chamar no WhatsApp depois do cadastro.",
};

// De onde o visitante veio (utm_* da campanha e site de origem). Guarda a primeira origem da visita na sessão.
// O presente da janela de saída (se houver) entra sempre, mesmo se a origem já estava guardada.
function lerOrigem(): string {
  try {
    const p = new URLSearchParams(window.location.search);
    const presente = p.get("presente") ?? "";
    const perda = (p.get("perda") ?? "").replace(/\D/g, "").slice(0, 7);
    const guardada = sessionStorage.getItem("ivva-origem");
    if (guardada) {
      if (!PRESENTES[presente]) return guardada;
      const g = JSON.parse(guardada) as Record<string, string>;
      g.presente = presente;
      if (perda) g.perda = perda;
      const json = JSON.stringify(g);
      sessionStorage.setItem("ivva-origem", json);
      return json;
    }
    const o: Record<string, string> = {};
    if (PRESENTES[presente]) o.presente = presente;
    if (perda) o.perda = perda;
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const val = (p.get(k) ?? "").trim().slice(0, 80);
      if (val) o[k] = val;
    }
    let ref = "";
    try {
      ref = document.referrer ? new URL(document.referrer).hostname : "";
    } catch {}
    if (ref && ref !== window.location.hostname) o.referrer = ref.slice(0, 80);
    const json = JSON.stringify(o);
    sessionStorage.setItem("ivva-origem", json);
    return json;
  } catch {
    return "{}";
  }
}

// Etapa de cadastro antes do pagamento. Os valores ficam guardados no estado para não sumirem se der erro.
function CadastroPanel({
  plano,
  anual,
  refCodigo,
  pix,
  onClientSecret,
  onPix,
  onVoltar,
}: {
  plano: Plano;
  anual: boolean;
  refCodigo: string;
  pix: boolean;
  onClientSecret: (clientSecret: string) => void;
  onPix: (p: PixPronto) => void;
  onVoltar: () => void;
}) {
  const [stateCartao, formActionCartao, pendingCartao] = useActionState(iniciarCadastro, ESTADO_INICIAL);
  const [statePix, formActionPix, pendingPix] = useActionState(iniciarCadastroPix, ESTADO_INICIAL_PIX);
  const state = pix ? statePix : stateCartao;
  const formAction = pix ? formActionPix : formActionCartao;
  const pending = pix ? pendingPix : pendingCartao;
  const [origem] = useState(lerOrigem);
  const [v, setV] = useState({ nome: "", email: "", telefone: "", nome_negocio: "", segmento: "", cpf_cnpj: "", aceite: false });
  const set = (k: keyof typeof v) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setV((x) => ({ ...x, [k]: k === "aceite" ? Boolean(e.target.checked) : e.target.value }));

  useEffect(() => {
    if (stateCartao.clientSecret) onClientSecret(stateCartao.clientSecret);
  }, [stateCartao.clientSecret, onClientSecret]);
  useEffect(() => {
    if (statePix.ref && statePix.pix && statePix.valor)
      onPix({ ref: statePix.ref, copiaECola: statePix.pix.copiaECola, imagem: statePix.pix.imagem, valor: statePix.valor });
  }, [statePix, onPix]);

  return (
    <div className="mx-auto max-w-[560px]">
      <p className="mb-4 text-center text-[13px] text-[#a5a3b0]">
        Assinando <strong className="text-[#f7f6f2]">{plano.nome}</strong> ·{" "}
        {anual ? `R$ ${fmt(totalAnual(plano))}/ano (2 meses grátis)` : `R$ ${plano.preco}/mês`} ·{" "}
        {pix ? "pagamento no Pix, acesso na hora" : "14 dias grátis"}
      </p>
      {(() => {
        try {
          const presente = (JSON.parse(origem) as Record<string, string>).presente;
          return PRESENTES[presente] ? (
            <p className="-mt-2 mb-4 rounded-xl bg-[#2fbf9f]/10 px-3 py-2 text-center text-[12.5px] font-semibold text-[#2fbf9f]">🎁 {PRESENTES[presente]}</p>
          ) : null;
        } catch {
          return null;
        }
      })()}
      {refCodigo && !anual && !pix && (
        <p className="-mt-2 mb-4 text-center text-[12.5px] font-semibold text-[#2fbf9f]">
          Link de indicação: se o código for válido, você ganha 10% na primeira mensalidade.
        </p>
      )}
      <div className="rounded-3xl bg-white p-7 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
        <h2 className="text-[20px] font-extrabold text-[#0e0e13]">Conte um pouco sobre você e o seu negócio</h2>
        <p className="mt-1 text-[13px] text-[#6b6577]">
          {pix
            ? "Leva 1 minuto. Em seguida aparece o Pix do primeiro mês; pagou, o acesso é liberado na hora."
            : "Leva 1 minuto. Em seguida vem o pagamento, com 14 dias grátis."}
        </p>

        <form action={formAction} className="mt-5 flex flex-col gap-3.5">
          <input type="hidden" name="plano" value={plano.key} />
          <input type="hidden" name="ciclo" value={anual ? "anual" : "mensal"} />
          <input type="hidden" name="ref" value={refCodigo} />
          <input type="hidden" name="origem" value={origem} />
          <div>
            <label htmlFor="cad-nome" className={ROTULO}>Seu nome</label>
            <input id="cad-nome" name="nome" required autoComplete="name" placeholder="Como podemos te chamar" className={CAMPO} defaultValue={v.nome} onChange={set("nome")} />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="cad-email" className={ROTULO}>E-mail</label>
              <input id="cad-email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" className={CAMPO} defaultValue={v.email} onChange={set("email")} />
            </div>
            <div>
              <label htmlFor="cad-tel" className={ROTULO}>WhatsApp</label>
              <input id="cad-tel" name="telefone" type="tel" required autoComplete="tel" placeholder="(11) 99999-9999" className={CAMPO} defaultValue={v.telefone} onChange={set("telefone")} />
            </div>
          </div>
          <div>
            <label htmlFor="cad-negocio" className={ROTULO}>Nome do seu negócio</label>
            <input id="cad-negocio" name="nome_negocio" required autoComplete="organization" placeholder="Ex.: Studio Bella" className={CAMPO} defaultValue={v.nome_negocio} onChange={set("nome_negocio")} />
          </div>
          <div>
            <label htmlFor="cad-segmento" className={ROTULO}>Tipo de negócio</label>
            <select id="cad-segmento" name="segmento" required className={CAMPO} defaultValue={v.segmento} onChange={set("segmento")}>
              <option value="" disabled>Escolha o seu tipo de negócio</option>
              {SEGMENTOS.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
            <p className="mt-1 text-[11.5px] text-[#8a8896]">Com isso já deixamos o robô com um modelo pronto para o seu nicho.</p>
          </div>
          {pix && (
            <div>
              <label htmlFor="cad-doc" className={ROTULO}>CPF ou CNPJ</label>
              <input id="cad-doc" name="cpf_cnpj" required inputMode="numeric" placeholder="Para emitir a cobrança do Pix" className={CAMPO} defaultValue={v.cpf_cnpj} onChange={set("cpf_cnpj")} />
              <p className="mt-1 text-[11.5px] text-[#8a8896]">Exigido pelo Asaas, parceiro de pagamentos da ivva, para emitir as cobranças.</p>
            </div>
          )}
          <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-[#6b6577]">
            <input type="checkbox" name="aceite" required className="mt-0.5 h-4 w-4 accent-[#2fbf9f]" defaultChecked={v.aceite} onChange={set("aceite")} />
            <span>
              Li e aceito o{" "}
              <a href="/contrato" target="_blank" rel="noreferrer" className="font-semibold text-[#6d5be0] underline">Contrato de Prestação de Serviços</a>
              , os{" "}
              <a href="https://ivva.app.br/termos" target="_blank" rel="noreferrer" className="font-semibold text-[#6d5be0] underline">Termos de Uso</a>{" "}
              e a{" "}
              <a href="https://ivva.app.br/privacidade" target="_blank" rel="noreferrer" className="font-semibold text-[#6d5be0] underline">Política de Privacidade</a>
              , e que a ivva pode entrar em contato sobre o meu cadastro.
            </span>
          </label>

          {state.erro && (
            <p role="alert" className="rounded-xl bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">
              {state.erro}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)] disabled:opacity-60"
          >
            {pending ? (pix ? "Gerando o Pix…" : "Preparando o pagamento…") : pix ? "Gerar o Pix" : "Continuar para o pagamento"}
          </button>
        </form>
      </div>
      <button onClick={onVoltar} className="mx-auto mt-6 block text-[13px] text-[#a5a3b0] hover:text-[#f7f6f2]">
        ← Voltar pros planos
      </button>
    </div>
  );
}

function PixPanel({ pix, plano, anual, onVoltar }: { pix: PixPronto; plano: Plano; anual: boolean; onVoltar: () => void }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [pago, setPago] = useState(false);

  // Pergunta a cada 4 s se o pagamento chegou; ao confirmar, segue para criar o acesso (mesma tela do cartão).
  useEffect(() => {
    let ativo = true;
    const id = setInterval(async () => {
      try {
        const s = await situacaoPix(pix.ref);
        if (ativo && s === "pago") {
          setPago(true);
          clearInterval(id);
          router.push(`/bem-vindo?session_id=${pix.ref}`);
        }
      } catch {}
    }, 4000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [pix.ref, router]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(pix.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {}
  };

  return (
    <div className="mx-auto max-w-[480px]">
      <p className="mb-4 text-center text-[13px] text-[#a5a3b0]">
        Assinando <strong className="text-[#f7f6f2]">{plano.nome}</strong> · {anual ? "plano anual" : "plano mensal"} · pagamento no Pix
      </p>
      <div className="rounded-3xl bg-white p-7 text-center text-[#0e0e13] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
        <h2 className="text-[20px] font-extrabold">Pague com o Pix</h2>
        <p className="mt-1 text-[13px] text-[#6b6577]">
          {pix.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · abra o app do seu banco e escaneie o código
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${pix.imagem}`} alt="QR Code do Pix" className="mx-auto mt-5 h-56 w-56" />
        <button
          type="button"
          onClick={copiar}
          className="mt-4 w-full rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] py-3 text-[14px] font-semibold text-white"
        >
          {copiado ? "Código copiado ✓" : "Copiar código Pix (copia e cola)"}
        </button>
        <p className="mt-4 flex items-center justify-center gap-2 text-[12.5px] font-semibold text-[#6b6577]" aria-live="polite">
          <span className={`inline-block h-2 w-2 rounded-full ${pago ? "bg-[#2fbf9f]" : "animate-pulse bg-[#8b7fe8]"}`} />
          {pago ? "Pagamento confirmado! Abrindo o seu acesso…" : "Aguardando o pagamento. Esta tela atualiza sozinha."}
        </p>
        <p className="mt-4 text-[11.5px] leading-relaxed text-[#8a8896]">
          {anual
            ? "A renovação anual chega por e-mail antes do vencimento."
            : "Nos próximos meses, a cobrança do Pix chega por e-mail alguns dias antes do vencimento."}{" "}
          Se a página fechar, o código também foi enviado para o seu e-mail.
        </p>
      </div>
      <button onClick={onVoltar} className="mx-auto mt-6 block text-[13px] text-[#a5a3b0] hover:text-[#f7f6f2]">
        ← Voltar pros planos
      </button>
    </div>
  );
}

function EmbeddedPanel({ clientSecret }: { clientSecret: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let checkout: StripeEmbeddedCheckout | null = null;
    let cancelado = false;

    stripePromise.then(async (stripe) => {
      if (!stripe || cancelado || !containerRef.current) return;
      const embedded = await stripe.createEmbeddedCheckoutPage({ clientSecret });
      if (cancelado) {
        embedded.destroy();
        return;
      }
      checkout = embedded;
      embedded.mount(containerRef.current);
    });

    return () => {
      cancelado = true;
      checkout?.destroy();
    };
  }, [clientSecret]);

  return <div ref={containerRef} />;
}

export default function PlanosClient({ planos, pixDisponivel = false }: { planos: Plano[]; pixDisponivel?: boolean }) {
  const [checkout, setCheckout] = useState<{ clientSecret: string; plano: Plano } | null>(null);
  const [escolhido, setEscolhido] = useState<Plano | null>(null);
  const [comPix, setComPix] = useState(false);
  const [pixPronto, setPixPronto] = useState<{ pix: PixPronto; plano: Plano } | null>(null);
  const [volume, setVolume] = useState<number | null>(null);
  const [anual, setAnual] = useState(false);
  const [refCodigo, setRefCodigo] = useState("");
  // Vindo do site (ivva.app.br) com ?ciclo=anual, já abre no anual.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ciclo") === "anual") setAnual(true);
    // Código de indicação (Indique e ganhe) vindo do link de quem indicou.
    const ref = (params.get("ref") ?? "").trim();
    if (/^[A-Za-z0-9]{3,20}$/.test(ref)) setRefCodigo(ref.toUpperCase());
  }, []);
  // Menor plano que comporta o volume escolhido (acima do maior, indica o maior).
  const indicado =
    volume === null
      ? null
      : ([...planos].sort((a, b) => a.conversas - b.conversas).find((p) => p.conversas >= volume) ??
        [...planos].sort((a, b) => b.conversas - a.conversas)[0]
      ).key;

  if (checkout) {
    return (
      <div className="mx-auto max-w-[560px]">
        <p className="mb-4 text-center text-[13px] text-[#a5a3b0]">
          Assinando <strong className="text-[#f7f6f2]">{checkout.plano.nome}</strong> · {anual ? `R$ ${fmt(totalAnual(checkout.plano))}/ano` : `R$ ${checkout.plano.preco}/mês`}
        </p>
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
          <EmbeddedPanel clientSecret={checkout.clientSecret} />
        </div>
        <button
          onClick={() => {
            setCheckout(null);
            setEscolhido(null);
          }}
          className="mx-auto mt-6 block text-[13px] text-[#a5a3b0] hover:text-[#f7f6f2]"
        >
          ← Voltar pros planos
        </button>
      </div>
    );
  }

  if (pixPronto) {
    return (
      <PixPanel
        pix={pixPronto.pix}
        plano={pixPronto.plano}
        anual={anual}
        onVoltar={() => {
          setPixPronto(null);
          setEscolhido(null);
        }}
      />
    );
  }

  if (escolhido) {
    return (
      <CadastroPanel
        plano={escolhido}
        anual={anual}
        refCodigo={refCodigo}
        pix={comPix}
        onClientSecret={(clientSecret) => setCheckout({ clientSecret, plano: escolhido })}
        onPix={(pix) => setPixPronto({ pix, plano: escolhido })}
        onVoltar={() => setEscolhido(null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col items-center gap-2">
        <div role="group" aria-label="Ciclo de cobrança" className="flex rounded-full border border-white/15 bg-white/5 p-1">
          {[
            { v: false, l: "Mensal" },
            { v: true, l: "Anual" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              aria-pressed={anual === o.v}
              onClick={() => setAnual(o.v)}
              className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-colors ${
                anual === o.v ? "bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] text-white" : "text-[#c7c5d1] hover:text-[#f7f6f2]"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        <p className="text-[12px] font-semibold text-[#2fbf9f]">Anual: 2 meses grátis</p>
      </div>
      <div className="mb-8 text-center">
        <p className="text-[13.5px] font-semibold text-[#c7c5d1]">Quantas conversas você atende por mês?</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Volume de conversas por mês">
          {VOLUMES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVolume(volume === v ? null : v)}
              aria-pressed={volume === v}
              className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
                volume === v
                  ? "border-transparent bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] text-white"
                  : "border-white/15 text-[#c7c5d1] hover:border-white/30 hover:text-[#f7f6f2]"
              }`}
            >
              {v === VOLUMES[VOLUMES.length - 1] ? `${fmt(v)} ou mais` : `até ${fmt(v)}`}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[#8a8896]">
          Uma conversa reúne todas as respostas da IA a um mesmo cliente em até 24 horas.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3 md:items-stretch">
      {planos.map((p) => (
        <motion.div
          key={p.key}
          id={p.key}
          whileHover={{
            y: -10,
            boxShadow:
              "0 22px 50px -18px rgba(47,191,159,0.45), 0 32px 70px -22px rgba(139,127,232,0.55), 0 20px 46px -20px rgba(255,107,91,0.4)",
            transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
          }}
          className={`relative scroll-mt-24 rounded-3xl target:shadow-[0_20px_55px_-15px_rgba(139,127,232,0.6)] ${
            p.destaque
              ? "bg-[linear-gradient(145deg,#2fbf9f,#8b7fe8_55%,#ff6b5b)] p-[2px] shadow-[0_40px_90px_-25px_rgba(139,127,232,0.55)]"
              : "bg-white/10 p-px target:ring-2 target:ring-[#8b7fe8] target:ring-offset-2 target:ring-offset-[#0b0b10]"
          }`}
        >
          <div
            className={`relative flex h-full flex-col rounded-[calc(1.5rem-2px)] p-7 ${
              p.destaque ? "bg-[#14131b] text-[#f7f6f2]" : "bg-white"
            }`}
          >
            {p.destaque && (
              <span className="absolute -top-3.5 left-7 rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-3 py-1 text-[11px] font-bold text-white shadow-lg">
                Mais escolhido
              </span>
            )}
            <h2 className={`text-[19px] font-extrabold ${p.destaque ? "text-[#f7f6f2]" : "text-[#0e0e13]"}`}>
              {p.nome}
            </h2>
            <p className={`mt-1.5 text-[13px] ${p.destaque ? "text-[#a5a3b0]" : "text-[#6b6577]"}`}>
              {p.descricao}
            </p>
            <p className={`mt-5 flex items-baseline gap-1 ${p.destaque ? "text-[#f7f6f2]" : "text-[#0e0e13]"}`}>
              <span className="text-sm font-semibold opacity-70">R$</span>
              <span className="text-[38px] font-extrabold tracking-[-0.03em]">{anual ? brl(totalAnual(p) / 12) : p.preco}</span>
              <span className={`text-[13px] ${p.destaque ? "text-[#a5a3b0]" : "text-[#8a8896]"}`}>/mês</span>
            </p>
            {anual && (
              <p className={`mt-1.5 text-[12px] font-semibold ${p.destaque ? "text-[#2fbf9f]" : "text-[#1f9a7f]"}`}>
                R$ {fmt(totalAnual(p))} por ano, pago de uma vez · 2 meses grátis
              </p>
            )}
            <p
              className={`mt-3 rounded-xl px-3 py-2 text-[13px] font-bold ${
                p.destaque ? "bg-white/8 text-[#f7f6f2]" : "bg-[#f3f1ec] text-[#0e0e13]"
              }`}
            >
              {fmt(p.conversas)} conversas/mês com a IA
              <span className={`block text-[11.5px] font-medium ${p.destaque ? "text-[#a5a3b0]" : "text-[#8a8896]"}`}>
                ≈ {fmt(p.conversas * 6)} respostas
              </span>
            </p>
            {indicado === p.key && (
              <span className="mt-3 inline-block self-start rounded-full bg-[#2fbf9f] px-3 py-1 text-[11px] font-bold text-white">
                Indicado pro seu volume
              </span>
            )}

            <ul className="mt-6 flex flex-1 flex-col gap-2.5">
              {p.recursos.map((r) => (
                <li
                  key={r}
                  className={`flex items-start gap-2.5 text-[13px] ${
                    p.destaque ? "text-[#c7c5d1]" : "text-[#6b6577]"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-[#2fbf9f]">
                    <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {r}
                </li>
              ))}
            </ul>

            <CardForm
              destaque={p.destaque}
              onEscolher={() => {
                setComPix(false);
                setEscolhido(p);
              }}
              onEscolherPix={
                pixDisponivel
                  ? () => {
                      setComPix(true);
                      setEscolhido(p);
                    }
                  : undefined
              }
            />
          </div>
        </motion.div>
      ))}
      </div>
    </div>
  );
}

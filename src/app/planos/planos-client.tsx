"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { assinarPlano, type AssinarPlanoState } from "./actions";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

type Plano = {
  key: string;
  nome: string;
  preco: number;
  descricao: string;
  destaque?: boolean;
  recursos: string[];
};

const ESTADO_INICIAL: AssinarPlanoState = { erro: null, clientSecret: null };

function CardForm({
  plano,
  destaque,
  onClientSecret,
}: {
  plano: string;
  destaque?: boolean;
  onClientSecret: (clientSecret: string) => void;
}) {
  const [state, formAction, pending] = useActionState(assinarPlano, ESTADO_INICIAL);

  useEffect(() => {
    if (state.clientSecret) onClientSecret(state.clientSecret);
  }, [state.clientSecret, onClientSecret]);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-2">
      <input type="hidden" name="plano" value={plano} />
      <input
        name="nome_negocio"
        required
        placeholder="Nome do seu negócio"
        className={`rounded-xl border px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#2fbf9f] ${
          destaque
            ? "border-white/15 bg-white/5 text-[#f7f6f2] placeholder:text-[#a5a3b0]"
            : "border-[rgba(14,14,19,0.16)] bg-white text-[#0e0e13] placeholder:text-[#8a8896]"
        }`}
      />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-full py-3 text-[13.5px] font-semibold transition-shadow disabled:opacity-60 ${
          destaque
            ? "bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)] hover:shadow-[0_14px_40px_-8px_rgba(139,127,232,0.85)]"
            : "bg-[#0e0e13] text-white hover:bg-[#23222c]"
        }`}
      >
        {pending ? "Abrindo pagamento…" : "Assinar"}
      </button>
      {state.erro && <p className="text-[12px] font-semibold text-[#ff6b5b]">{state.erro}</p>}
    </form>
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

export default function PlanosClient({ planos }: { planos: Plano[] }) {
  const [checkout, setCheckout] = useState<{ clientSecret: string; plano: Plano } | null>(null);

  if (checkout) {
    return (
      <div className="mx-auto max-w-[560px]">
        <p className="mb-4 text-center text-[13px] text-[#a5a3b0]">
          Assinando <strong className="text-[#f7f6f2]">{checkout.plano.nome}</strong> · R${" "}
          {checkout.plano.preco}/mês
        </p>
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
          <EmbeddedPanel clientSecret={checkout.clientSecret} />
        </div>
        <button
          onClick={() => setCheckout(null)}
          className="mx-auto mt-6 block text-[13px] text-[#a5a3b0] hover:text-[#f7f6f2]"
        >
          ← Voltar pros planos
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-3 md:items-stretch">
      {planos.map((p) => (
        <div
          key={p.key}
          id={p.key}
          className={`relative scroll-mt-24 rounded-3xl transition-shadow target:shadow-[0_20px_55px_-15px_rgba(139,127,232,0.6)] ${
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
              <span className="text-[38px] font-extrabold tracking-[-0.03em]">{p.preco}</span>
              <span className={`text-[13px] ${p.destaque ? "text-[#a5a3b0]" : "text-[#8a8896]"}`}>/mês</span>
            </p>

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
              plano={p.key}
              destaque={p.destaque}
              onClientSecret={(clientSecret) => setCheckout({ clientSecret, plano: p })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

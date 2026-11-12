"use client";

import { useActionState, useEffect, useRef } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { SEGMENTOS } from "@/lib/segmentos";
import { iniciarCadastroFundador, type FundadorState } from "./actions";
import { FUNDADORES } from "./regras";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");
const INICIAL: FundadorState = { erro: null, clientSecret: null };
const CAMPO =
  "w-full rounded-xl border border-[rgba(14,14,19,0.16)] bg-white px-4 py-2.5 text-[14px] text-[#0e0e13] outline-none placeholder:text-[#8a8896] focus:ring-2 focus:ring-[#2fbf9f]";
const ROTULO = "mb-1 block text-[12.5px] font-bold text-[#0e0e13]";

function Pagamento({ clientSecret }: { clientSecret: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let checkout: StripeEmbeddedCheckout | null = null;
    let cancelado = false;
    stripePromise.then(async (stripe) => {
      if (!stripe || cancelado || !ref.current) return;
      const embedded = await stripe.createEmbeddedCheckoutPage({ clientSecret });
      if (cancelado) {
        embedded.destroy();
        return;
      }
      checkout = embedded;
      embedded.mount(ref.current);
    });
    return () => {
      cancelado = true;
      checkout?.destroy();
    };
  }, [clientSecret]);
  return <div ref={ref} />;
}

export default function FundadoresClient() {
  const [state, action, pending] = useActionState(iniciarCadastroFundador, INICIAL);

  if (state.clientSecret) {
    return (
      <div className="mx-auto max-w-[560px]">
        <p className="mb-4 text-center text-[13px] text-[#a5a3b0]">
          Último passo: cadastre o cartão. <strong className="text-[#f7f6f2]">Hoje você paga R$ 0,00</strong>; a primeira cobrança só acontece em{" "}
          {FUNDADORES.primeiraCobranca}, e você pode cancelar até {FUNDADORES.ultimoDiaCancelar}.
        </p>
        <div className="overflow-hidden rounded-3xl bg-white p-2 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
          <Pagamento clientSecret={state.clientSecret} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] rounded-3xl bg-white p-7 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
      <h2 className="text-[20px] font-extrabold text-[#0e0e13]">Entre para os Fundadores da ivva</h2>
      <p className="mt-1 text-[13px] text-[#6b6577]">Leva 1 minuto. Em seguida você cadastra o cartão (R$ 0,00 hoje) e o acesso é liberado.</p>
      <form action={action} className="mt-5 flex flex-col gap-3.5">
        <div>
          <label htmlFor="f-nome" className={ROTULO}>Seu nome</label>
          <input id="f-nome" name="nome" required autoComplete="name" placeholder="Como podemos te chamar" className={CAMPO} />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor="f-email" className={ROTULO}>E-mail</label>
            <input id="f-email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" className={CAMPO} />
          </div>
          <div>
            <label htmlFor="f-tel" className={ROTULO}>WhatsApp</label>
            <input id="f-tel" name="telefone" type="tel" required autoComplete="tel" placeholder="(11) 99999-9999" className={CAMPO} />
          </div>
        </div>
        <div>
          <label htmlFor="f-negocio" className={ROTULO}>Nome do seu negócio</label>
          <input id="f-negocio" name="nome_negocio" required autoComplete="organization" placeholder="Ex.: Studio Bella" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="f-seg" className={ROTULO}>Tipo de negócio</label>
          <select id="f-seg" name="segmento" required defaultValue="" className={CAMPO}>
            <option value="" disabled>Escolha o seu tipo de negócio</option>
            {SEGMENTOS.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-[#ece9fc] px-3.5 py-3 text-[12.5px] leading-snug text-[#2b2540]">
          <input type="checkbox" name="aceite_cobranca" required className="mt-0.5 h-4 w-4 accent-[#6d5be0]" />
          <span>
            Entendo que hoje pago <strong>R$ 0,00</strong>, que posso cancelar sem custo <strong>até {FUNDADORES.ultimoDiaCancelar}</strong> e que, se não cancelar,
            o cartão será cobrado em <strong>{FUNDADORES.primeiraCobranca}</strong> (R$ {FUNDADORES.precoMensal},00 por mês, plano {FUNDADORES.nomePlano}).
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-[#6b6577]">
          <input type="checkbox" name="aceite" required className="mt-0.5 h-4 w-4 accent-[#2fbf9f]" />
          <span>
            Li e aceito o{" "}
            <a href="/contrato" target="_blank" rel="noreferrer" className="font-semibold text-[#6d5be0] underline">Contrato de Prestação de Serviços</a>, os{" "}
            <a href="https://ivva.app.br/termos" target="_blank" rel="noreferrer" className="font-semibold text-[#6d5be0] underline">Termos de Uso</a> e a{" "}
            <a href="https://ivva.app.br/privacidade" target="_blank" rel="noreferrer" className="font-semibold text-[#6d5be0] underline">Política de Privacidade</a>
            , as regras do programa e que a ivva pode entrar em contato sobre o meu cadastro.
          </span>
        </label>
        {state.erro && (
          <p role="alert" className="rounded-xl bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">{state.erro}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)] disabled:opacity-60"
        >
          {pending ? "Preparando o pagamento…" : "Continuar e cadastrar o cartão"}
        </button>
      </form>
    </div>
  );
}

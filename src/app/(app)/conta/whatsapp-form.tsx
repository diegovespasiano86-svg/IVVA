"use client";

import { useActionState, useState } from "react";
import { conectarWhatsApp, pedirAjudaWhatsApp } from "./actions";

const PASSOS = [
  {
    titulo: "Crie sua conta de desenvolvedor Meta",
    detalhe:
      'Acesse developers.facebook.com, clique em "Começar" no canto superior direito e faça login com seu Facebook. Confirme seu e-mail e celular quando pedir.',
  },
  {
    titulo: "Crie um app",
    detalhe:
      'Em "Meus apps", clique em "Criar app". Dê o nome do seu negócio, escolha o caso de uso "Conectar-se com clientes pelo WhatsApp" e conclua a criação.',
  },
  {
    titulo: "Ative o WhatsApp no app",
    detalhe:
      "Dentro do app, vá em Casos de uso > WhatsApp e siga a Etapa 1 (Experimente). A Meta vai te dar um número de teste — ou já pode configurar seu número real na Etapa 2.",
  },
  {
    titulo: "Copie as 3 informações abaixo",
    detalhe:
      "Ainda na mesma tela: Phone Number ID, WhatsApp Business Account ID e o Token de acesso (clique em \"Gerar token\"). Cole os três aqui embaixo.",
  },
];

export default function WhatsAppForm() {
  const [error, formAction, pending] = useActionState(
    conectarWhatsApp,
    undefined,
  );
  const [mostrarPasso, setMostrarPasso] = useState(true);
  const [pedindoAjuda, setPedindoAjuda] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setMostrarPasso((v) => !v)}
        className="mb-3 flex items-center gap-1.5 text-[12.5px] font-bold text-purple"
      >
        {mostrarPasso ? "Esconder" : "Ver"} passo a passo
        <svg
          className="icon"
          viewBox="0 0 24 24"
          width="13"
          height="13"
          style={{
            transform: mostrarPasso ? "rotate(180deg)" : "none",
            transition: "transform .15s",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {mostrarPasso && (
        <ol className="mb-5 flex flex-col gap-3">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-soft text-[12px] font-bold text-ink-soft">
                {i + 1}
              </span>
              <div>
                <p className="text-[13px] font-bold">{p.titulo}</p>
                <p className="text-[12.5px] leading-relaxed text-ink-soft">
                  {p.detalhe}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form action={formAction} className="flex flex-col gap-2.5">
        <div>
          <label htmlFor="phone_number_id" className="!mb-1">
            Phone Number ID
          </label>
          <input
            id="phone_number_id"
            name="phone_number_id"
            required
            placeholder="Ex: 136065653045..."
            className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
          />
        </div>
        <div>
          <label htmlFor="business_account_id" className="!mb-1">
            WhatsApp Business Account ID
          </label>
          <input
            id="business_account_id"
            name="business_account_id"
            placeholder="Ex: 164317883736..."
            className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
          />
        </div>
        <div>
          <label htmlFor="access_token" className="!mb-1">
            Token de acesso
          </label>
          <input
            id="access_token"
            name="access_token"
            required
            type="password"
            placeholder="Cole o token gerado"
            className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
          />
        </div>
        <div>
          <label htmlFor="display_phone_number" className="!mb-1">
            Número que aparece pro cliente (opcional)
          </label>
          <input
            id="display_phone_number"
            name="display_phone_number"
            placeholder="+55 11 90000-0000"
            className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
          />
        </div>

        {error && (
          <p className="text-[12.5px] font-semibold text-coral">{error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn mt-1 justify-center bg-ink py-2.5 text-[13.5px] text-white disabled:opacity-60"
        >
          {pending ? "Conectando…" : "Conectar WhatsApp"}
        </button>
      </form>

      <div className="mt-4 border-t border-border pt-4">
        {!pedindoAjuda ? (
          <button
            type="button"
            onClick={() => setPedindoAjuda(true)}
            className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink-soft hover:text-ink"
          >
            <svg className="icon" viewBox="0 0 24 24" width="15" height="15">
              <path d="M12 17h.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1 1.2-1 2.2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
            </svg>
            Não consegui fazer sozinho — pedir ajuda
          </button>
        ) : (
          <form action={pedirAjudaWhatsApp} className="flex flex-col gap-2">
            <textarea
              name="mensagem"
              rows={2}
              placeholder="Em que passo travou? (opcional)"
              className="resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
            <button
              type="submit"
              className="btn justify-center bg-purple py-2.5 text-[13px] text-white"
            >
              Enviar pedido de ajuda
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

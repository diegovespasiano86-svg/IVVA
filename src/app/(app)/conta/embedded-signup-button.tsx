"use client";

import { useEffect, useRef, useState } from "react";
import { conectarWhatsAppEmbedded, pedirAjudaWhatsApp } from "./actions";

const PASSOS = [
  {
    titulo: "Baixe o WhatsApp Business",
    detalhe:
      "No celular que vai atender pelo negócio, instale o app \"WhatsApp Business\" (Play Store ou App Store) — é diferente do WhatsApp comum.",
  },
  {
    titulo: "Ative um número dedicado",
    detalhe:
      "Abra o WhatsApp Business e cadastre um número que NÃO esteja em uso no WhatsApp pessoal. Pode ser um chip novo ou um fixo com confirmação por ligação.",
  },
  {
    titulo: "Clique em \"Conectar com um clique\" abaixo",
    detalhe:
      "Vai abrir uma janela da Meta (dona do WhatsApp). Faça login com uma conta do Facebook — pode ser a sua pessoal, só precisa existir.",
  },
  {
    titulo: "Escolha \"conectar seu número existente\"",
    detalhe:
      "Quando a Meta reconhecer que o número já está ativo no WhatsApp Business, ela oferece a opção de conectar esse número (em vez de criar um novo). Escolha essa opção e confirme.",
  },
  {
    titulo: "Pronto",
    detalhe:
      "A tela volta pra \"Conectado\" automaticamente. O app do WhatsApp Business continua funcionando normal no celular, em paralelo com a ivva.",
  },
];

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (opts: {
        appId: string;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: { code?: string };
          status?: string;
        }) => void,
        opts: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras: { featureType: string; setup: Record<string, never> };
        },
      ) => void;
    };
  }
}

type SessaoEmbedded = {
  phoneNumberId: string | null;
  wabaId: string | null;
  isCoexistence: boolean;
  finalizada: boolean;
  erro: string | null;
};

const SDK_SRC = "https://connect.facebook.net/pt_BR/sdk.js";

export default function EmbeddedSignupButton() {
  const [sdkPronto, setSdkPronto] = useState(false);
  const [status, setStatus] = useState<"idle" | "aguardando" | "salvando" | "erro">("idle");
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarPasso, setMostrarPasso] = useState(true);
  const [pedindoAjuda, setPedindoAjuda] = useState(false);
  const [ajudaEnviada, setAjudaEnviada] = useState(false);
  const sessaoRef = useRef<SessaoEmbedded>({
    phoneNumberId: null,
    wabaId: null,
    isCoexistence: false,
    finalizada: false,
    erro: null,
  });
  const codeRef = useRef<string | null>(null);

  const appId = process.env.NEXT_PUBLIC_WHATSAPP_APP_ID;
  const configId = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID;

  useEffect(() => {
    if (window.FB) {
      setSdkPronto(true);
      return;
    }
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = SDK_SRC;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.body.appendChild(script);
    }
    window.fbAsyncInit = () => {
      if (!appId) return;
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: true, version: "v26.0" });
      setSdkPronto(true);
    };
  }, [appId]);

  // Concluir a conexão exige dois pedaços de informação que chegam por
  // canais diferentes e em ordem que não dá pra prever: o "code" vem do
  // callback do FB.login, e o phone_number_id/waba_id vêm de uma mensagem
  // postMessage separada que a Meta manda pro popup. Só tenta salvar
  // quando os dois já chegaram.
  async function tentarFinalizar() {
    const sessao = sessaoRef.current;
    if (sessao.finalizada) return;
    if (!codeRef.current || !sessao.phoneNumberId || !sessao.wabaId) return;

    sessao.finalizada = true;
    setStatus("salvando");

    const resultado = await conectarWhatsAppEmbedded({
      code: codeRef.current,
      phoneNumberId: sessao.phoneNumberId,
      wabaId: sessao.wabaId,
      isCoexistence: sessao.isCoexistence,
    });

    if (resultado.erro) {
      setErro(resultado.erro);
      setStatus("erro");
    }
    // Sucesso: revalidatePath já atualiza a página (Server Component busca
    // de novo a conta e troca a tela pra "Conectado").
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (typeof event.origin !== "string" || !event.origin.endsWith("facebook.com")) return;

      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      const payload = data as {
        type?: string;
        event?: string;
        data?: { phone_number_id?: string; waba_id?: string };
      };
      if (payload.type !== "WA_EMBEDDED_SIGNUP") return;

      if (payload.event === "ERROR") {
        sessaoRef.current.erro = "A Meta recusou o login. Tenta de novo.";
        setErro(sessaoRef.current.erro);
        setStatus("erro");
        return;
      }

      if (payload.event?.startsWith("FINISH")) {
        sessaoRef.current.phoneNumberId = payload.data?.phone_number_id ?? null;
        sessaoRef.current.wabaId = payload.data?.waba_id ?? null;
        sessaoRef.current.isCoexistence = payload.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";
        void tentarFinalizar();
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function iniciar() {
    if (!window.FB || !configId) {
      setErro("Configuração do login com a Meta ausente — fala com o suporte.");
      setStatus("erro");
      return;
    }

    setErro(null);
    setStatus("aguardando");
    sessaoRef.current = { phoneNumberId: null, wabaId: null, isCoexistence: false, finalizada: false, erro: null };
    codeRef.current = null;

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setErro("Login cancelado ou não autorizado.");
          setStatus("erro");
          return;
        }
        codeRef.current = code;
        void tentarFinalizar();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { featureType: "whatsapp_business_app_onboarding", setup: {} },
      },
    );
  }

  if (!appId || !configId) {
    return (
      <p className="text-[12.5px] font-semibold text-coral">
        Login com a Meta não configurado — fala com o suporte.
      </p>
    );
  }

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

      <button
        type="button"
        onClick={iniciar}
        disabled={!sdkPronto || status === "aguardando" || status === "salvando"}
        className="btn w-full justify-center bg-[#1877f2] py-2.5 text-[13.5px] text-white disabled:opacity-60"
      >
        {status === "salvando"
          ? "Conectando…"
          : status === "aguardando"
            ? "Complete o login na janela que abriu…"
            : "Conectar com um clique"}
      </button>

      <p className="mt-2 text-[12px] text-ink-faint">
        Você vai logar direto com o WhatsApp Business que já usa — sem
        precisar criar conta de desenvolvedor nem copiar nada.
      </p>

      {status === "erro" && erro && (
        <div className="mt-3 rounded-[10px] border border-coral/30 bg-coral/5 px-3.5 py-2.5">
          <p className="text-[12.5px] font-semibold text-coral">{erro}</p>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        {ajudaEnviada ? (
          <div className="flex items-center gap-2 rounded-[10px] border border-teal/30 bg-teal/5 px-3.5 py-2.5">
            <svg className="icon shrink-0 text-teal" viewBox="0 0 24 24" width="16" height="16">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <p className="text-[12.5px] font-semibold text-teal">
              Chamado aberto! Alguém da equipe vai entrar em contato pra te ajudar a conectar.
            </p>
          </div>
        ) : !pedindoAjuda ? (
          <button
            type="button"
            onClick={() => setPedindoAjuda(true)}
            className="flex items-center gap-1.5 text-[12.5px] font-bold text-coral hover:text-coral"
          >
            <svg className="icon" viewBox="0 0 24 24" width="15" height="15">
              <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            Travei aqui — chamar suporte agora
          </button>
        ) : (
          <form
            action={async (formData) => {
              await pedirAjudaWhatsApp(formData);
              setAjudaEnviada(true);
            }}
            className="flex flex-col gap-2"
          >
            <p className="text-[12px] text-ink-soft">
              Isso abre um chamado que cai direto pra quem está implantando a ivva pra você.
            </p>
            <textarea
              name="mensagem"
              rows={2}
              placeholder="O que aconteceu? (opcional)"
              className="resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
            <button
              type="submit"
              className="btn justify-center bg-coral py-2.5 text-[13px] text-white"
            >
              Enviar chamado de emergência
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

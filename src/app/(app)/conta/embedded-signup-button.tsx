"use client";

import { useEffect, useRef, useState } from "react";
import { conectarWhatsAppEmbedded } from "./actions";

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
    </div>
  );
}

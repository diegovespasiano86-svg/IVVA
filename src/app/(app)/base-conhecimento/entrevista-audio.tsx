"use client";

import { useActionState, useRef, useState } from "react";
import { processarAudio, type ExtracaoState } from "./actions";
import RevisarEntradas from "./revisar-entradas";

const initialState: ExtracaoState = { entradas: [], erro: null, aviso: null, arquivoId: null };

export default function EntrevistaAudio() {
  const [state, formAction, pending] = useActionState(
    processarAudio,
    initialState,
  );
  const [gravando, setGravando] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [erroMic, setErroMic] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);

  async function iniciarGravacao() {
    setErroMic(null);
    setAudioUrl(null);
    blobRef.current = null;

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErroMic("Esse navegador não dá suporte a gravação de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
    } catch {
      setErroMic(
        "Não consegui acessar o microfone — confere a permissão do navegador.",
      );
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    setGravando(false);
  }

  function enviarGravacao() {
    const blob = blobRef.current;
    if (!blob) return;
    const extensao = blob.type.includes("mp4") ? "mp4" : "webm";
    const fd = new FormData();
    fd.append("audio", new File([blob], `entrevista.${extensao}`, { type: blob.type }));
    formAction(fd);
  }

  return (
    <div>
      <p className="mb-3 text-[13px] text-ink-soft">
        Grave contando sobre seus serviços, preços, horários e políticas — a
        ivva transcreve e sugere os itens pra base de conhecimento, pra você
        revisar antes de salvar.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {!gravando ? (
          <button
            type="button"
            onClick={iniciarGravacao}
            className="btn bg-ink px-4 py-2 text-[12.5px] text-white"
          >
            <span className="h-2 w-2 rounded-full bg-coral" /> Gravar
          </button>
        ) : (
          <button
            type="button"
            onClick={pararGravacao}
            className="btn bg-coral px-4 py-2 text-[12.5px] text-white"
          >
            ■ Parar
          </button>
        )}

        {audioUrl && !gravando && (
          <>
            <audio controls src={audioUrl} className="h-8" />
            <button
              type="button"
              onClick={enviarGravacao}
              disabled={pending}
              className="btn bg-purple px-4 py-2 text-[12.5px] text-white disabled:opacity-60"
            >
              {pending ? "Transcrevendo…" : "Processar áudio"}
            </button>
          </>
        )}
      </div>

      {erroMic && (
        <p className="mt-2 text-[12px] font-semibold text-coral">{erroMic}</p>
      )}

      {state.erro && (
        <div className="mt-3 rounded-[10px] border border-coral/30 bg-coral/5 px-3.5 py-2.5">
          <p className="text-[12.5px] font-semibold text-coral">{state.erro}</p>
        </div>
      )}

      {!state.erro && state.entradas.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-teal/30 bg-teal/5 px-3.5 py-2.5">
          <svg className="icon shrink-0 text-teal" viewBox="0 0 24 24" width="16" height="16">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <p className="text-[12.5px] font-semibold text-teal">
            Transcrito com sucesso — revise os itens abaixo antes de salvar.
          </p>
        </div>
      )}

      {state.aviso && (
        <div className="mt-3 rounded-[10px] border border-purple/30 bg-purple/5 px-3.5 py-2.5">
          <p className="text-[12.5px] font-semibold text-purple">{state.aviso}</p>
        </div>
      )}

      <RevisarEntradas
        key={state.entradas.join("|")}
        entradas={state.entradas}
        tipo="audio"
        arquivoId={null}
      />
    </div>
  );
}

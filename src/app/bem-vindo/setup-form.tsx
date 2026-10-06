"use client";

import { useState, useActionState } from "react";
import { finalizarCadastro } from "./actions";
import ConfirmarEmail from "./confirmar-email";
import { SEGMENTOS, getSegmento } from "@/lib/segmentos";

const CAMPO =
  "w-full rounded-xl border border-[rgba(14,14,19,0.16)] bg-white px-4 py-2.5 text-[14px] text-[#0e0e13] outline-none placeholder:text-[#8a8896] focus:ring-2 focus:ring-[#2fbf9f]";
const ROTULO = "mb-1 block text-[12.5px] font-bold text-[#0e0e13]";

export default function SetupForm({
  sessionId,
  nomeInicial = "",
  segmentoInicial = null,
}: {
  sessionId: string;
  nomeInicial?: string;
  segmentoInicial?: string | null;
}) {
  const [estado, formAction, pending] = useActionState(finalizarCadastro, undefined);
  const error = estado?.erro ?? null;
  // O tipo de negócio já foi escolhido antes do pagamento; só perguntamos de novo em links antigos sem essa informação.
  const segmentoConhecido = segmentoInicial && getSegmento(segmentoInicial) ? segmentoInicial : null;
  const [segmento, setSegmento] = useState<string>(segmentoConhecido ?? "");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const senhasIguais = senha.length >= 8 && senha === senha2;

  if (estado?.confirmar) return <ConfirmarEmail email={estado.confirmar} sessionId={sessionId} />;

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-3.5">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="segmento" value={segmento} />

      {segmentoConhecido && (
        <p className="rounded-xl bg-[#f3f1fb] px-3.5 py-2.5 text-[12.5px] text-[#4a4458]">
          Tipo de negócio: <strong>{getSegmento(segmentoConhecido)?.nome}</strong>. O robô já vem com o modelo pronto para o seu nicho.
        </p>
      )}

      <div>
        <label htmlFor="nome" className={ROTULO}>Seu nome</label>
        <input id="nome" name="nome" required defaultValue={nomeInicial} placeholder="Como podemos te chamar" className={CAMPO} />
      </div>

      {!segmentoConhecido && (
        <div>
          <label htmlFor="seg" className={ROTULO}>Tipo de negócio</label>
          <select id="seg" required className={CAMPO} value={segmento} onChange={(e) => setSegmento(e.target.value)}>
            <option value="" disabled>Escolha o seu tipo de negócio</option>
            {SEGMENTOS.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="senha" className={ROTULO}>Crie uma senha</label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Pelo menos 8 caracteres"
          className={CAMPO}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="senha2" className={ROTULO}>Repita a senha</label>
        <input
          id="senha2"
          name="senha2"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Digite a mesma senha de novo"
          className={CAMPO}
          value={senha2}
          onChange={(e) => setSenha2(e.target.value)}
          aria-invalid={senha2.length > 0 && senha !== senha2}
        />
        {senha2.length > 0 && senha !== senha2 && (
          <p role="alert" className="mt-1.5 text-[12.5px] font-semibold text-[#c2402c]">
            As senhas não são iguais. Confira e digite de novo.
          </p>
        )}
        {senhasIguais && <p className="mt-1.5 text-[12.5px] font-semibold text-[#1f9a80]">As senhas conferem.</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !segmento || !senhasIguais}
        className="mt-1 rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)] disabled:opacity-60"
      >
        {pending
          ? "Criando o seu acesso…"
          : !segmento
            ? "Escolha seu tipo de negócio"
            : !senhasIguais
              ? "Digite a mesma senha nos dois campos"
              : "Continuar"}
      </button>
    </form>
  );
}

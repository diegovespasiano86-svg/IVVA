"use client";

import { useActionState, useState } from "react";
import { Copy, ShieldCheck, UserRound } from "lucide-react";
import { criarConvite, type ConviteState } from "./actions";
import { ACESSOS, type PapelConvite } from "@/lib/acessos";

const initialState: ConviteState = {
  erro: null,
  link: null,
  emailEnviado: false,
  emailMotivo: null,
};

export default function InviteForm({ rotuloBotao = "+ Convidar" }: { rotuloBotao?: string }) {
  const [state, formAction, pending] = useActionState(criarConvite, initialState);
  const [copiado, setCopiado] = useState(false);
  const [papel, setPapel] = useState<PapelConvite>("profissional");
  const acesso = ACESSOS[papel];

  async function copiarLink() {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível (ex: contexto não seguro) — o link já
      // fica visível na tela pra copiar manualmente.
    }
  }

  return (
    <div>
      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="invite-nome" className="!mb-1">
              Nome
            </label>
            <input
              id="invite-nome"
              name="nome"
              required
              maxLength={80}
              placeholder="Nome da pessoa"
              className="input w-[170px]"
            />
          </div>
          <div>
            <label htmlFor="invite-email" className="!mb-1">
              E-mail
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="pessoa@email.com"
              className="input w-[210px]"
            />
          </div>
          <div>
            <label htmlFor="invite-papel" className="!mb-1">
              Tipo de acesso
            </label>
            <select
              id="invite-papel"
              name="papel"
              value={papel}
              onChange={(e) => setPapel(e.target.value as PapelConvite)}
              className="select w-[170px]"
            >
              <option value="profissional">{ACESSOS.profissional.rotulo}</option>
              <option value="dono">{ACESSOS.dono.rotulo}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn bg-ink px-4 py-2 text-[12.5px] text-white disabled:opacity-60"
          >
            {pending ? "Enviando…" : rotuloBotao}
          </button>
        </div>

        <div
          className={`rounded-[12px] border px-3.5 py-3 text-[12.5px] ${
            papel === "dono" ? "border-amber/40 bg-[#fdf0dc]" : "border-border bg-surface-soft/50"
          }`}
        >
          <p className="mb-1 flex items-center gap-1.5 font-bold">
            {papel === "dono" ? <ShieldCheck size={14} /> : <UserRound size={14} />}
            {acesso.rotulo}: {acesso.resumo}
          </p>
          <p className="mb-1 mt-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Poderá</p>
          <ul className="list-disc pl-5 text-ink-soft">
            {acesso.pode.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          {acesso.naoPode.length > 0 && (
            <>
              <p className="mb-1 mt-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
                Fica só com o administrador
              </p>
              <ul className="list-disc pl-5 text-ink-soft">
                {acesso.naoPode.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </>
          )}
          {papel === "dono" && (
            <label className="mt-3 flex items-center gap-2 font-semibold">
              <input type="checkbox" name="atende" defaultChecked className="h-4 w-4" />
              Também atende clientes (aparece na agenda)
            </label>
          )}
        </div>
      </form>

      {state.erro && <p className="mt-2 text-[12px] font-semibold text-coral">{state.erro}</p>}

      {state.link && !state.erro && (
        <div className="mt-3 rounded-[10px] border border-teal/30 bg-teal/5 px-3.5 py-3">
          <p className="mb-1.5 text-[12px] font-bold text-teal">
            {state.emailEnviado
              ? "Convite enviado por e-mail. Se preferir, o link também pode ir pelo WhatsApp:"
              : "Convite criado — envie esse link pra pessoa pelo WhatsApp"}
          </p>
          {!state.emailEnviado && state.emailMotivo && (
            <p className="mb-1.5 text-[11.5px] text-ink-soft">O e-mail não saiu: {state.emailMotivo}.</p>
          )}
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-surface px-2.5 py-1.5 text-[12px]">{state.link}</code>
            <button
              type="button"
              onClick={copiarLink}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:bg-surface-soft"
            >
              <Copy size={12} />
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

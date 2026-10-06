"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Mail, UserPlus } from "lucide-react";
import {
  adicionarProfissional,
  convidarProfissional,
  type ConviteProfissionalState,
  type ProfissionalState,
} from "./actions";

export type ProfissionalItem = {
  id: string;
  nome: string;
  cor: string;
  comissao_pct: number;
  /** "ativo" = já tem login · "convite" = convite pendente · "nenhum" = só cadastro */
  acesso: "ativo" | "convite" | "nenhum";
  /** o dono é quem atende neste cadastro */
  ehDono: boolean;
};

const CORES = ["#8B7FE8", "#2FBF9F", "#FF6B5B", "#F5A524", "#2F6FDE", "#E85D9E", "#14121B", "#7A8B99"];

const ESTADO_INICIAL: ProfissionalState = { erro: null, ok: false };
const CONVITE_INICIAL: ConviteProfissionalState = {
  erro: null,
  enviado: false,
  link: null,
  email: null,
  motivoSemEmail: null,
};

function AdicionarForm({ mostrarComissao, donoJaAtende }: { mostrarComissao: boolean; donoJaAtende: boolean }) {
  const [estado, formAction, pending] = useActionState(adicionarProfissional, ESTADO_INICIAL);
  const [cor, setCor] = useState(CORES[0]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="prof-nome" className="!mb-1">
          Nome
        </label>
        <input id="prof-nome" name="nome" required maxLength={80} placeholder="Ex.: João" className="input w-[190px]" />
      </div>

      <fieldset>
        <legend className="!mb-1 text-[12px] font-semibold text-ink-soft">Cor na agenda</legend>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Cor na agenda">
          {CORES.map((c) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="cor"
                value={c}
                checked={cor === c}
                onChange={() => setCor(c)}
                className="peer sr-only"
              />
              <span
                className="block h-7 w-7 rounded-full border-2 border-transparent peer-checked:border-ink peer-focus-visible:ring-2 peer-focus-visible:ring-purple"
                style={{ background: c }}
                title={c}
              />
            </label>
          ))}
        </div>
      </fieldset>

      {mostrarComissao && (
        <div>
          <label htmlFor="prof-comissao" className="!mb-1">
            Comissão (%)
          </label>
          <input
            id="prof-comissao"
            name="comissao_pct"
            type="number"
            min={0}
            max={100}
            step="0.5"
            defaultValue={0}
            className="input w-[100px]"
          />
        </div>
      )}

      {!donoJaAtende && (
        <label className="flex items-center gap-2 pb-2 text-[12.5px] font-semibold text-ink-soft">
          <input type="checkbox" name="sou_eu" className="h-4 w-4 accent-[var(--color-purple,#6d5be0)]" />
          Sou eu quem atende
        </label>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-sm disabled:opacity-60">
        {pending ? "Salvando…" : "Cadastrar profissional"}
      </button>

      {estado.erro && <p className="w-full text-[12px] font-semibold text-coral">{estado.erro}</p>}
      {estado.ok && <p className="w-full text-[12px] font-semibold text-teal">Profissional cadastrado.</p>}
    </form>
  );
}

function ConvidarForm({ profissional }: { profissional: ProfissionalItem }) {
  const [estado, formAction, pending] = useActionState(convidarProfissional, CONVITE_INICIAL);
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!estado.link) return;
    try {
      await navigator.clipboard.writeText(estado.link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* o link já está visível para copiar à mão */
    }
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="btn btn-secondary btn-sm">
        <Mail size={14} />
        {profissional.acesso === "convite" ? "Reenviar convite" : "Convidar por e-mail"}
      </button>
    );
  }

  return (
    <div className="w-full">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="professional_id" value={profissional.id} />
        <div>
          <label htmlFor={`email-${profissional.id}`} className="!mb-1">
            E-mail de {profissional.nome.split(" ")[0]}
          </label>
          <input
            id={`email-${profissional.id}`}
            name="email"
            type="email"
            required
            placeholder="pessoa@email.com"
            className="input w-[230px]"
          />
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm disabled:opacity-60">
          {pending ? "Enviando…" : "Enviar convite"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-[12.5px] font-semibold text-ink-faint hover:text-ink">
          Cancelar
        </button>
      </form>

      <p className="mt-1.5 text-[11.5px] text-ink-faint">
        A pessoa recebe um link para criar a própria senha e entra como profissional: vê a agenda e as conversas, sem
        acesso às configurações do negócio.
      </p>

      {estado.erro && <p className="mt-2 text-[12px] font-semibold text-coral">{estado.erro}</p>}

      {estado.link && !estado.erro && (
        <div className="mt-3 rounded-[10px] border border-teal/30 bg-teal/5 px-3.5 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-teal">
            <Check size={14} />
            {estado.enviado
              ? `Convite enviado por e-mail para ${estado.email}.`
              : "Convite criado, mas o e-mail não saiu. Envie o link abaixo pelo WhatsApp."}
          </p>
          {!estado.enviado && estado.motivoSemEmail && (
            <p className="mb-1.5 text-[11.5px] text-ink-soft">Motivo: {estado.motivoSemEmail}.</p>
          )}
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-surface px-2.5 py-1.5 text-[12px]">{estado.link}</code>
            <button
              type="button"
              onClick={copiar}
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

const ROTULO_ACESSO: Record<ProfissionalItem["acesso"], { texto: string; classe: string }> = {
  ativo: { texto: "Tem acesso", classe: "bg-teal/10 text-teal" },
  convite: { texto: "Convite pendente", classe: "bg-amber/15 text-[#7a4a00]" },
  nenhum: { texto: "Sem acesso ao sistema", classe: "bg-surface-soft text-ink-faint" },
};

export default function ProfissionaisCard({
  profissionais,
  mostrarComissao,
}: {
  profissionais: ProfissionalItem[];
  mostrarComissao: boolean;
}) {
  const donoJaAtende = profissionais.some((p) => p.ehDono);
  const vazio = profissionais.length === 0;

  return (
    <section className="card mb-4 px-4 py-4" aria-labelledby="titulo-profissionais">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="titulo-profissionais" className="text-[13.5px] font-extrabold">
            Profissionais da equipe
          </h2>
          <p className="text-[12.5px] text-ink-soft">
            O robô só marca horário de quem estiver cadastrado aqui. Cadastre quem atende e, se quiser, convide a
            pessoa por e-mail para ela acessar o sistema.
          </p>
        </div>
      </div>

      {vazio && (
        <div className="mb-3 rounded-[12px] border border-amber/30 bg-[#fdf0dc] px-3.5 py-3 text-[12.5px] font-semibold text-[#7a4a00]">
          Nenhum profissional cadastrado ainda. Cadastre ao menos um (pode ser você) para o robô conseguir agendar.
        </div>
      )}

      {!vazio && (
        <ul className="mb-4 flex flex-col divide-y divide-border">
          {profissionais.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: p.cor }} aria-hidden />
              <span className="min-w-[120px] text-[13.5px] font-semibold">
                {p.nome}
                {p.ehDono && <span className="ml-1.5 text-[11.5px] font-medium text-ink-faint">(você)</span>}
              </span>
              {mostrarComissao && (
                <span className="text-[12px] text-ink-faint">Comissão {Number(p.comissao_pct)}%</span>
              )}
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROTULO_ACESSO[p.acesso].classe}`}>
                {p.ehDono ? "Dono" : ROTULO_ACESSO[p.acesso].texto}
              </span>
              {p.acesso !== "ativo" && !p.ehDono && (
                <div className="ml-auto">
                  <ConvidarForm profissional={p} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="group rounded-[12px] border border-border bg-surface-soft/40" open={vazio}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] font-bold [&::-webkit-details-marker]:hidden">
          <UserPlus size={15} />
          Adicionar profissional
        </summary>
        <div className="border-t border-border px-3.5 py-3.5">
          <AdicionarForm mostrarComissao={mostrarComissao} donoJaAtende={donoJaAtende} />
        </div>
      </details>
    </section>
  );
}

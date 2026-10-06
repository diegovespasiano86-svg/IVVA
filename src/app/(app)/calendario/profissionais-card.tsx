"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import InviteForm from "../conta/invite-form";
import { revogarConvite } from "../conta/actions";
import { euTambemAtendo, type EuAtendoState } from "./actions";

export type ProfissionalItem = {
  id: string;
  nome: string;
  cor: string;
  comissao_pct: number;
  /** o dono é quem atende neste cadastro */
  ehDono: boolean;
};

export type ConvitePendenteItem = {
  id: string;
  nome: string;
  email: string;
  papel: "profissional" | "dono";
};

const ESTADO_INICIAL: EuAtendoState = { erro: null };

function EuTambemAtendo() {
  const [estado, formAction, pending] = useActionState(euTambemAtendo, ESTADO_INICIAL);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <button type="submit" disabled={pending} className="btn btn-secondary btn-sm disabled:opacity-60">
        {pending ? "Cadastrando…" : "Eu também atendo clientes"}
      </button>
      <span className="text-[11.5px] text-ink-faint">
        Coloca você na agenda, para o robô poder marcar horário com você.
      </span>
      {estado.erro && <span className="w-full text-[12px] font-semibold text-coral">{estado.erro}</span>}
    </form>
  );
}

export default function ProfissionaisCard({
  profissionais,
  convites,
  mostrarComissao,
}: {
  profissionais: ProfissionalItem[];
  convites: ConvitePendenteItem[];
  mostrarComissao: boolean;
}) {
  const donoJaAtende = profissionais.some((p) => p.ehDono);
  const vazio = profissionais.length === 0 && convites.length === 0;

  return (
    <section className="card mb-4 px-4 py-4" aria-labelledby="titulo-profissionais">
      <div className="mb-3">
        <h2 id="titulo-profissionais" className="text-[13.5px] font-extrabold">
          Equipe e profissionais
        </h2>
        <p className="text-[12.5px] text-ink-soft">
          Cada pessoa entra por convite de e-mail: você informa o nome e o e-mail, escolhe o tipo de acesso e ela
          cria a própria senha. O robô só marca horário de quem estiver na agenda.
        </p>
      </div>

      {vazio && (
        <div className="mb-3 rounded-[12px] border border-amber/30 bg-[#fdf0dc] px-3.5 py-3 text-[12.5px] font-semibold text-[#7a4a00]">
          Ninguém na agenda ainda. Convide um profissional abaixo ou coloque você mesmo na agenda para o robô
          conseguir agendar.
        </div>
      )}

      {profissionais.length > 0 && (
        <ul className="mb-3 flex flex-col divide-y divide-border">
          {profissionais.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: p.cor }} aria-hidden />
              <span className="min-w-[120px] text-[13.5px] font-semibold">
                {p.nome}
                {p.ehDono && <span className="ml-1.5 text-[11.5px] font-medium text-ink-faint">(você)</span>}
              </span>
              {mostrarComissao && <span className="text-[12px] text-ink-faint">Comissão {p.comissao_pct}%</span>}
              <span className="rounded-full bg-teal/10 px-2.5 py-0.5 text-[11px] font-bold text-teal">
                {p.ehDono ? "Administrador" : "Tem acesso"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {convites.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Convites pendentes</p>
          <ul className="flex flex-col gap-1.5">
            {convites.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{c.nome}</p>
                  <p className="truncate text-[11.5px] text-ink-faint">
                    {c.email} · {c.papel === "dono" ? "Administrador" : "Usuário"} · aguardando cadastro
                  </p>
                </div>
                <form action={revogarConvite}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-ink-faint hover:bg-surface-soft hover:text-coral"
                  >
                    Cancelar convite
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="group rounded-[12px] border border-border bg-surface-soft/40" open={vazio}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] font-bold [&::-webkit-details-marker]:hidden">
          <UserPlus size={15} />
          Cadastrar profissional por e-mail
        </summary>
        <div className="border-t border-border px-3.5 py-3.5">
          <InviteForm rotuloBotao="Enviar convite" />
        </div>
      </details>

      {!donoJaAtende && (
        <div className="mt-3">
          <EuTambemAtendo />
        </div>
      )}
    </section>
  );
}

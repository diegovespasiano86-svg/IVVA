"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { SEGMENTOS } from "@/lib/segmentos";
import { aplicarModeloNicho } from "./blocos-actions";

export default function NichoSeletor({ segmentoAtual, totalItens }: { segmentoAtual: string | null; totalItens: number }) {
  const [escolhido, setEscolhido] = useState<string | null>(segmentoAtual);
  const [aberto, setAberto] = useState(!segmentoAtual || totalItens === 0);
  const [estado, formAction, pendente] = useActionState(aplicarModeloNicho, undefined);

  const atual = SEGMENTOS.find((s) => s.id === (segmentoAtual ?? ""));

  if (!aberto && atual) {
    return (
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e3f4ef] text-teal">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Seu nicho</p>
            <p className="text-[15px] font-extrabold leading-tight">{atual.nome}</p>
            <p className="text-[12.5px] text-ink-soft">{atual.descricao}</p>
          </div>
        </div>
        <button type="button" onClick={() => setAberto(true)} className="btn btn-secondary btn-md">
          Trocar nicho ou reaplicar modelo
        </button>
      </div>
    );
  }

  return (
    <section className="card mb-5 overflow-hidden">
      <header className="border-b border-border bg-[linear-gradient(100deg,#f6f4fe_0%,#fdf6ee_100%)] px-5 py-4">
        <p className="text-[11.5px] font-bold uppercase tracking-wide text-purple">Passo 1</p>
        <h2 className="text-[17px] font-extrabold">Qual é o seu nicho?</h2>
        <p className="text-[12.5px] text-ink-soft">
          A gente preenche os blocos com um modelo pronto do seu segmento (serviços, preços, horários, políticas). Depois é só ajustar os valores. Nada que você já escreveu é apagado.
        </p>
      </header>
      <form action={formAction} className="px-5 py-5">
        <input type="hidden" name="segmento_id" value={escolhido ?? ""} />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {SEGMENTOS.map((s) => {
            const ativo = escolhido === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setEscolhido(s.id)}
                aria-pressed={ativo}
                className={`group rounded-xl border px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(109,91,224,0.45)] ${
                  ativo ? "border-purple bg-[#f6f4fe] shadow-[0_0_0_1px_var(--purple)]" : "border-border bg-surface hover:border-purple/50"
                }`}
              >
                <p className="text-[13px] font-extrabold leading-tight">{s.nome}</p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-soft">{s.descricao}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!escolhido || pendente} className={`btn btn-primary btn-lg ${pendente ? "btn-loading" : ""}`}>
            <Sparkles size={16} /> Preencher meus blocos
          </button>
          {atual && (
            <button type="button" onClick={() => setAberto(false)} className="btn btn-ghost btn-md">
              Cancelar
            </button>
          )}
          {estado && !estado.erro && (
            <p className="text-[12.5px] font-semibold text-teal">
              {estado.adicionados > 0
                ? `${estado.adicionados} itens adicionados nos blocos${estado.jaExistiam > 0 ? ` (${estado.jaExistiam} já existiam)` : ""}. Agora ajuste os valores abaixo.`
                : "Esse modelo já estava todo na sua base."}
            </p>
          )}
          {estado?.erro && <p className="text-[12.5px] font-semibold text-coral">{estado.erro}</p>}
        </div>
      </form>
    </section>
  );
}

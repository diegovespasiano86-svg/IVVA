"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Sparkles } from "lucide-react";
import { ETAPAS_DIAGNOSTICO, PRIORIDADES, erroDaEtapa, type Respostas } from "@/lib/diagnostico";
import { salvarDiagnostico } from "@/app/(app)/diagnostico-actions";

// Popup obrigatório do 1º acesso: o dono responde o diagnóstico (5 etapas curtas) para liberar o sistema.
// Salva a cada etapa, então quem fechar a aba continua de onde parou.
export default function DiagnosticoObrigatorio({
  nome,
  negocio,
  respostasIniciais,
  etapaInicial,
}: {
  nome: string;
  negocio: string;
  respostasIniciais: Respostas;
  etapaInicial: number;
}) {
  const total = ETAPAS_DIAGNOSTICO.length;
  // -1 = boas-vindas; 0..total-1 = etapas; total = concluído
  const [passo, setPasso] = useState(() => (etapaInicial > 0 ? Math.min(etapaInicial, total - 1) : -1));
  const [r, setR] = useState<Respostas>(() => ({
    ...respostasIniciais,
    prioridades:
      Array.isArray(respostasIniciais.prioridades) && respostasIniciais.prioridades.length === PRIORIDADES.length
        ? respostasIniciais.prioridades
        : [...PRIORIDADES],
  }));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const topo = useRef<HTMLDivElement>(null);
  const primeiroNome = nome.trim().split(/\s+/)[0] || "";

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  useEffect(() => {
    topo.current?.scrollTo({ top: 0 });
  }, [passo]);

  const setTexto = (id: string, v: string) => setR((x) => ({ ...x, [id]: v }));
  const alternar = (id: string, opcao: string, max?: number) =>
    setR((x) => {
      const atual = Array.isArray(x[id]) ? (x[id] as string[]) : [];
      if (atual.includes(opcao)) return { ...x, [id]: atual.filter((o) => o !== opcao) };
      if (max && atual.length >= max) return x;
      return { ...x, [id]: [...atual, opcao] };
    });
  const mover = (i: number, d: -1 | 1) =>
    setR((x) => {
      const lista = [...(x.prioridades as string[])];
      const j = i + d;
      if (j < 0 || j >= lista.length) return x;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return { ...x, prioridades: lista };
    });

  function avancar() {
    if (passo < 0) {
      setPasso(0);
      return;
    }
    const etapa = ETAPAS_DIAGNOSTICO[passo];
    const e = erroDaEtapa(etapa, r);
    if (e) {
      setErro(e);
      return;
    }
    setErro(null);
    const ultima = passo === total - 1;
    iniciar(async () => {
      const res = await salvarDiagnostico(r, passo + 1, ultima);
      if (res.erro) {
        setErro(res.erro);
        return;
      }
      setPasso(passo + 1);
    });
  }

  if (passo >= total) {
    return (
      <Moldura>
        <div className="p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal text-white">
            <Check size={28} />
          </span>
          <h2 className="mt-4 font-display text-[24px] font-extrabold">Tudo certo{primeiroNome ? `, ${primeiroNome}` : ""}! 🎉</h2>
          <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-relaxed text-ink-soft">
            Recebemos o diagnóstico da {negocio}. Nosso time de implantação já está lendo e vai te chamar no WhatsApp para
            marcar a conversa de implantação. Enquanto isso, o sistema já é seu.
          </p>
          <button type="button" onClick={() => window.location.reload()} className="btn btn-primary btn-lg mt-6">
            Entrar no sistema
          </button>
        </div>
      </Moldura>
    );
  }

  if (passo < 0) {
    return (
      <Moldura>
        <div className="p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2fbf9f,#8b7fe8)] text-white">
            <Sparkles size={22} />
          </span>
          <h2 className="mt-4 font-display text-[24px] font-extrabold leading-tight">
            Parabéns{primeiroNome ? `, ${primeiroNome}` : ""}! Bem-vindo(a) à ivva
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
            Antes de liberar o sistema, queremos conhecer a <strong className="text-ink">{negocio}</strong>. São 5 etapas rápidas
            (uns 4 minutos) sobre o seu negócio, seus clientes e o que você quer conquistar.
          </p>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
            O sistema tem vídeos que explicam tudo, mas o nosso <strong className="text-ink">time de implantação</strong> vai
            entrar em contato para te apoiar. Com essas respostas, a conversa já começa certeira.
          </p>
          <p className="mt-3 text-[12.5px] text-ink-faint">Suas respostas ficam salvas a cada etapa e só o time da ivva vê.</p>
          <button type="button" onClick={avancar} className="btn btn-primary btn-lg mt-6 w-full">
            Começar o diagnóstico
          </button>
        </div>
      </Moldura>
    );
  }

  const etapa = ETAPAS_DIAGNOSTICO[passo];
  return (
    <Moldura>
      <div className="border-b border-border px-7 pb-4 pt-6">
        <div className="flex items-center justify-between text-[12px] font-semibold text-ink-faint">
          <span>
            Etapa {passo + 1} de {total}
          </span>
          <span>Diagnóstico do negócio</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#2fbf9f,#8b7fe8)] transition-all"
            style={{ width: `${((passo + 1) / total) * 100}%` }}
          />
        </div>
        <h2 className="mt-4 font-display text-[21px] font-extrabold">{etapa.titulo}</h2>
        <p className="mt-1 text-[13px] text-ink-soft">{etapa.subtitulo}</p>
      </div>

      <div ref={topo} className="max-h-[58vh] overflow-y-auto px-7 py-5">
        {etapa.prioridades && (
          <ol className="mb-6 flex flex-col gap-2">
            {(r.prioridades as string[]).map((p, i) => (
              <li key={p} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple/10 text-[13px] font-bold text-purple">
                  {i + 1}
                </span>
                <span className="flex-1 text-[14px] font-semibold">{p}</span>
                <button type="button" aria-label={`Subir ${p}`} disabled={i === 0} onClick={() => mover(i, -1)} className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-soft disabled:opacity-30">
                  <ArrowUp size={16} />
                </button>
                <button type="button" aria-label={`Descer ${p}`} disabled={i === PRIORIDADES.length - 1} onClick={() => mover(i, 1)} className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-soft disabled:opacity-30">
                  <ArrowDown size={16} />
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-col gap-5">
          {etapa.perguntas.map((p) => (
            <div key={p.id}>
              <label htmlFor={`dg-${p.id}`} className="mb-1.5 block text-[13.5px] font-semibold">
                {p.rotulo}
                {p.obrigatoria && <span className="text-coral"> *</span>}
                {p.tipo === "multi" && p.max ? <span className="font-normal text-ink-faint"> (até {p.max})</span> : null}
              </label>
              {p.tipo === "texto" &&
                (p.longo ? (
                  <textarea id={`dg-${p.id}`} rows={3} className="input w-full" placeholder={p.placeholder} value={String(r[p.id] ?? "")} onChange={(e) => setTexto(p.id, e.target.value)} />
                ) : (
                  <input id={`dg-${p.id}`} className="input w-full" placeholder={p.placeholder} value={String(r[p.id] ?? "")} onChange={(e) => setTexto(p.id, e.target.value)} />
                ))}
              {(p.tipo === "opcao" || p.tipo === "multi") && (
                <div className="flex flex-wrap gap-2" role={p.tipo === "opcao" ? "radiogroup" : "group"} aria-label={p.rotulo}>
                  {p.opcoes.map((o) => {
                    const ativo = p.tipo === "opcao" ? r[p.id] === o : Array.isArray(r[p.id]) && (r[p.id] as string[]).includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => (p.tipo === "opcao" ? setTexto(p.id, o) : alternar(p.id, o, p.max))}
                        className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                          ativo ? "border-purple bg-purple text-white" : "border-border bg-surface text-ink-soft hover:border-purple/50"
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-border px-7 py-4">
        {passo > 0 && (
          <button type="button" onClick={() => setPasso(passo - 1)} className="btn btn-ghost btn-md" disabled={pendente}>
            Voltar
          </button>
        )}
        <p className="flex-1 text-[12.5px] font-semibold text-coral" role="alert">
          {erro}
        </p>
        <button type="button" onClick={avancar} className={`btn btn-primary btn-md ${pendente ? "btn-loading" : ""}`} disabled={pendente}>
          {passo === total - 1 ? "Enviar e liberar o sistema" : "Continuar"}
        </button>
      </div>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-3 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Diagnóstico do negócio">
      <div className="w-full max-w-[600px] overflow-hidden rounded-3xl bg-white text-ink shadow-2xl">{children}</div>
    </div>
  );
}

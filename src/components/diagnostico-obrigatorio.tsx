"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { ETAPAS_DIAGNOSTICO, PRIORIDADES, erroDaEtapa, type Respostas } from "@/lib/diagnostico";
import { salvarDiagnostico } from "@/app/(app)/diagnostico-actions";
import IvvaLogo from "@/app/planos/logo";
import { GlowBackdrop } from "@/app/planos/brand-fx";

// Popup obrigatório do 1º acesso: o dono responde o diagnóstico (5 etapas curtas) para liberar o sistema.
// Salva a cada etapa, então quem fechar a aba continua de onde parou.
// Visual igual ao da landing e de /planos: faixa escura com brilho, logo, palavra em itálico com degradê, botões em pílula.

const CAMPO =
  "w-full rounded-xl border border-[rgba(14,14,19,0.16)] bg-white px-4 py-2.5 text-[14px] text-[#0e0e13] outline-none placeholder:text-[#8a8896] focus:ring-2 focus:ring-[#2fbf9f]";
const ROTULO = "mb-1.5 block text-[13px] font-bold text-[#0e0e13]";
const BOTAO =
  "rounded-full bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)] transition-shadow hover:shadow-[0_14px_40px_-8px_rgba(139,127,232,0.85)] disabled:opacity-60";
const SERIF = { fontFamily: "var(--font-instrument-serif), Georgia, serif" };

function Destaque({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-[linear-gradient(95deg,#2fbf9f_0%,#8b7fe8_55%,#ff6b5b_100%)] bg-clip-text font-normal italic text-transparent" style={SERIF}>
      {children}
    </span>
  );
}

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

  // Boas-vindas e conclusão: tudo na faixa escura, como o topo da landing.
  if (passo < 0 || passo >= total) {
    const fim = passo >= total;
    return (
      <Moldura>
        <Faixa>
          <div className="px-8 pb-9 pt-7">
            <IvvaLogo light />
            {fim ? (
              <>
                <span className="mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2fbf9f,#8b7fe8)] text-white shadow-[0_10px_30px_-8px_rgba(139,127,232,0.65)]">
                  <Check size={28} />
                </span>
                <h2 className="mt-5 text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[#f7f6f2]">
                  Tudo <Destaque>certo</Destaque>{primeiroNome ? `, ${primeiroNome}` : ""}!
                </h2>
                <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-[#c7c5d1]">
                  Recebemos o diagnóstico da <strong className="text-[#f7f6f2]">{negocio}</strong>. Nosso time de implantação já
                  está lendo e vai te chamar no WhatsApp para marcar a conversa de implantação. Enquanto isso, o sistema já é seu.
                </p>
                <button type="button" onClick={() => window.location.reload()} className={`${BOTAO} mt-7`}>
                  Entrar no sistema
                </button>
              </>
            ) : (
              <>
                <p className="mt-8 text-[12px] font-bold uppercase tracking-[0.14em] text-[#2fbf9f]">Primeiro acesso</p>
                <h2 className="mt-2 text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[#f7f6f2] sm:text-[32px]">
                  Parabéns{primeiroNome ? `, ${primeiroNome}` : ""}! Vamos conhecer o seu <Destaque>negócio</Destaque>
                </h2>
                <p className="mt-4 max-w-[480px] text-[15px] leading-relaxed text-[#c7c5d1]">
                  Antes de liberar o sistema, queremos entender a <strong className="text-[#f7f6f2]">{negocio}</strong>: são 5 etapas
                  rápidas, uns 4 minutos, sobre seus clientes, seu atendimento e onde você quer chegar.
                </p>
                <p className="mt-3 max-w-[480px] text-[15px] leading-relaxed text-[#c7c5d1]">
                  A ivva tem vídeos que explicam tudo, mas o nosso <strong className="text-[#f7f6f2]">time de implantação</strong> vai
                  entrar em contato para te apoiar. Com essas respostas, a conversa já começa certeira.
                </p>
                <ul className="mt-6 grid gap-2 text-[13.5px] text-[#c7c5d1] sm:grid-cols-3">
                  {["5 etapas curtas", "Salva a cada etapa", "Só o time da ivva vê"].map((t) => (
                    <li key={t} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <Check size={15} className="shrink-0 text-[#2fbf9f]" />
                      {t}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={avancar} className={`${BOTAO} mt-7 w-full py-3.5 text-[15px]`}>
                  Começar o diagnóstico
                </button>
              </>
            )}
          </div>
        </Faixa>
      </Moldura>
    );
  }

  const etapa = ETAPAS_DIAGNOSTICO[passo];
  const [primeiraPalavra, ...resto] = etapa.titulo.split(" ");
  return (
    <Moldura>
      <Faixa>
        <div className="px-7 pb-6 pt-6">
          <div className="flex items-center justify-between gap-3">
            <IvvaLogo light />
            <span className="rounded-full border border-white/15 px-3 py-1 text-[12px] font-semibold text-[#c7c5d1]">
              Etapa {passo + 1} de {total}
            </span>
          </div>
          <div className="mt-5 flex gap-1.5" aria-hidden>
            {ETAPAS_DIAGNOSTICO.map((e, i) => (
              <span
                key={e.titulo}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= passo ? "bg-[linear-gradient(90deg,#2fbf9f,#8b7fe8)]" : "bg-white/12"}`}
              />
            ))}
          </div>
          <h2 className="mt-5 text-[25px] font-extrabold leading-tight tracking-[-0.02em] text-[#f7f6f2]">
            {primeiraPalavra} <Destaque>{resto.join(" ")}</Destaque>
          </h2>
          <p className="mt-1.5 text-[13.5px] text-[#a5a3b0]">{etapa.subtitulo}</p>
        </div>
      </Faixa>

      <div ref={topo} className="max-h-[52vh] overflow-y-auto bg-white px-7 py-6">
        {etapa.prioridades && (
          <ol className="mb-7 flex flex-col gap-2">
            {(r.prioridades as string[]).map((p, i) => (
              <li
                key={p}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                  i < 3 ? "border-[#8b7fe8]/40 bg-[#8b7fe8]/[0.06]" : "border-[rgba(14,14,19,0.1)] bg-white"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                    i < 3 ? "bg-[linear-gradient(135deg,#2fbf9f,#8b7fe8)] text-white" : "bg-[#f1eff6] text-[#6b6577]"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-[14px] font-semibold text-[#0e0e13]">{p}</span>
                <button type="button" aria-label={`Subir ${p}`} disabled={i === 0} onClick={() => mover(i, -1)} className="rounded-lg p-1.5 text-[#6b6577] hover:bg-[#f1eff6] disabled:opacity-25">
                  <ArrowUp size={16} />
                </button>
                <button type="button" aria-label={`Descer ${p}`} disabled={i === PRIORIDADES.length - 1} onClick={() => mover(i, 1)} className="rounded-lg p-1.5 text-[#6b6577] hover:bg-[#f1eff6] disabled:opacity-25">
                  <ArrowDown size={16} />
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-col gap-5">
          {etapa.perguntas.map((p) => (
            <div key={p.id}>
              <label htmlFor={`dg-${p.id}`} className={ROTULO}>
                {p.rotulo}
                {p.obrigatoria && <span className="text-[#ff6b5b]"> *</span>}
                {p.tipo === "multi" && p.max ? <span className="font-normal text-[#8a8896]"> (até {p.max})</span> : null}
              </label>
              {p.tipo === "texto" &&
                (p.longo ? (
                  <textarea id={`dg-${p.id}`} rows={3} className={CAMPO} placeholder={p.placeholder} value={String(r[p.id] ?? "")} onChange={(e) => setTexto(p.id, e.target.value)} />
                ) : (
                  <input id={`dg-${p.id}`} className={CAMPO} placeholder={p.placeholder} value={String(r[p.id] ?? "")} onChange={(e) => setTexto(p.id, e.target.value)} />
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
                        className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-all ${
                          ativo
                            ? "border-transparent bg-[linear-gradient(100deg,#2fbf9f,#8b7fe8)] text-white shadow-[0_6px_18px_-8px_rgba(139,127,232,0.8)]"
                            : "border-[rgba(14,14,19,0.14)] bg-white text-[#353542] hover:border-[#8b7fe8]"
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

      <div className="flex items-center gap-3 border-t border-[rgba(14,14,19,0.08)] bg-[#faf9fc] px-7 py-4">
        {passo > 0 && (
          <button type="button" onClick={() => setPasso(passo - 1)} className="rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-[#6b6577] hover:bg-[#f1eff6]" disabled={pendente}>
            Voltar
          </button>
        )}
        <p className="flex-1 text-[12.5px] font-semibold text-[#e2533f]" role="alert">
          {erro}
        </p>
        <button type="button" onClick={avancar} className={BOTAO} disabled={pendente}>
          {pendente ? "Salvando…" : passo === total - 1 ? "Enviar e liberar o sistema" : "Continuar"}
        </button>
      </div>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0e0e13]/80 px-3 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Diagnóstico do negócio"
    >
      <div className="w-full max-w-[620px] overflow-hidden rounded-[28px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/10">{children}</div>
    </div>
  );
}

function Faixa({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden bg-[#0e0e13]">
      <GlowBackdrop />
      {children}
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, CircleAlert, Rocket, ShieldCheck, Users } from "lucide-react";
import PreviewWhatsApp from "@/components/preview-whatsapp";
import { IDIOMAS, SEGMENTOS_CAMPANHA, normalizarNomeModelo } from "@/lib/campanhas";
import { definirConsentimento, iniciarCampanha, prepararCampanha, salvarRascunho, type DadosRascunho } from "../actions";

type Opcao = { id: string; nome: string };
type Audiencia = { tipo: "todos" | "lista" | "etiqueta" | "segmento"; ids?: string[]; segmento?: string };

export type CampanhaEdicao = {
  id: string;
  nome: string;
  template_nome: string | null;
  template_idioma: string;
  usa_nome: boolean;
  mensagem_previa: string | null;
  audiencia: Audiencia;
  consentimento: boolean;
  total: number;
  ignorados: number;
};

type Resumo = { total: number; sem_aceite: number; invalido: number; duplicados: number };

const chave = (t: string, ids: string[], seg: string) => JSON.stringify([t, [...ids].sort(), t === "segmento" ? seg : ""]);

export default function CampanhaEditor({
  campanha,
  listas,
  etiquetas,
  whatsappAtivo,
  negocio,
}: {
  campanha: CampanhaEdicao;
  listas: Opcao[];
  etiquetas: Opcao[];
  whatsappAtivo: boolean;
  negocio: string;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(campanha.nome);
  const [templateNome, setTemplateNome] = useState(campanha.template_nome ?? "");
  const [idioma, setIdioma] = useState(campanha.template_idioma);
  const [usaNome, setUsaNome] = useState(campanha.usa_nome);
  const [previa, setPrevia] = useState(campanha.mensagem_previa ?? "");
  const [audTipo, setAudTipo] = useState<Audiencia["tipo"]>(campanha.audiencia.tipo);
  const [audIds, setAudIds] = useState<string[]>(campanha.audiencia.ids ?? []);
  const [segmento, setSegmento] = useState(campanha.audiencia.segmento ?? SEGMENTOS_CAMPANHA[0].id);
  const [agendar, setAgendar] = useState("");
  const [consentimento, setConsentimento] = useState(campanha.consentimento);
  const [resumo, setResumo] = useState<Resumo | null>(campanha.total > 0 ? { total: campanha.total, sem_aceite: campanha.ignorados, invalido: 0, duplicados: 0 } : null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciar] = useTransition();

  const [salvaChave, setSalvaChave] = useState(chave(campanha.audiencia.tipo, campanha.audiencia.ids ?? [], campanha.audiencia.segmento ?? ""));
  const [preparadaChave, setPreparadaChave] = useState(campanha.total > 0 ? chave(campanha.audiencia.tipo, campanha.audiencia.ids ?? [], campanha.audiencia.segmento ?? "") : "");
  const atual = chave(audTipo, audIds, String(segmento));
  const publicoMudou = atual !== preparadaChave;

  const nomeModeloOk = normalizarNomeModelo(templateNome);
  const podeIniciar = whatsappAtivo && !!nomeModeloOk && !!resumo && resumo.total > 0 && !publicoMudou && consentimento;

  function dados(): DadosRascunho {
    return {
      id: campanha.id,
      nome,
      templateNome,
      idioma,
      usaNome,
      previa,
      audTipo,
      audIds,
      segmento: String(segmento),
      agendadaPara: agendar ? new Date(agendar).toISOString() : null,
    };
  }

  async function salvar(): Promise<boolean> {
    const r = await salvarRascunho(dados());
    if (r.erro) {
      setErro(r.erro);
      return false;
    }
    if (atual !== salvaChave) {
      // O banco zera o consentimento e o público sempre que a audiência muda.
      setConsentimento(false);
      setResumo(null);
      setPreparadaChave("");
      setSalvaChave(atual);
    }
    return true;
  }

  function alternarId(id: string) {
    setAudIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  function calcular() {
    setErro(null);
    iniciar(async () => {
      if (!(await salvar())) return;
      const r = await prepararCampanha(campanha.id);
      if (r.erro !== null) return setErro(r.erro);
      const x = r.resultado as Record<string, number>;
      setResumo({ total: x.total, sem_aceite: x.ignorados_sem_aceite, invalido: x.ignorados_telefone_invalido, duplicados: x.ignorados_duplicados });
      setPreparadaChave(atual);
      setConsentimento(false);
    });
  }

  function alternarConsentimento(v: boolean) {
    setErro(null);
    setConsentimento(v);
    iniciar(async () => {
      const r = await definirConsentimento(campanha.id, v);
      if (r.erro) {
        setConsentimento(!v);
        setErro(r.erro);
      }
    });
  }

  function comecar() {
    setErro(null);
    iniciar(async () => {
      if (!(await salvar())) return;
      const r = await iniciarCampanha(campanha.id);
      if (r.erro) {
        setConfirmando(false);
        return setErro(r.erro);
      }
      router.refresh();
    });
  }

  const corpoModelo = useMemo(() => previa.trim(), [previa]);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        {/* ---------- passo 1 ---------- */}
        <section className="card px-5 py-5">
          <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-purple">Passo 1</p>
          <h2 className="mb-3 flex items-center gap-2 text-[16px] font-extrabold">
            <Users size={18} className="text-purple" /> Quem vai receber
          </h2>
          <label htmlFor="nome-camp">Nome da campanha (só você vê)</label>
          <input id="nome-camp" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className="input mb-4" />

          <div role="radiogroup" aria-label="Público" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["todos", "Todos os clientes", "Toda a sua base"],
                ["segmento", "Um perfil pronto", "Sumidos, novos, aniversariantes"],
                ["lista", "Uma lista", "Grupos que você montou"],
                ["etiqueta", "Uma etiqueta", "Clientes marcados"],
              ] as const
            ).map(([id, titulo, dica]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={audTipo === id}
                onClick={() => setAudTipo(id)}
                className={`rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 ${audTipo === id ? "border-purple bg-[#f6f4fe] shadow-[0_0_0_1px_var(--purple)]" : "border-border bg-surface hover:border-purple/50"}`}
              >
                <p className="text-[13.5px] font-extrabold">{titulo}</p>
                <p className="text-[12px] text-ink-soft">{dica}</p>
              </button>
            ))}
          </div>

          {audTipo === "segmento" && (
            <div className="mt-3 grid gap-2">
              {SEGMENTOS_CAMPANHA.map((s) => (
                <label key={s.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${segmento === s.id ? "border-purple bg-[#f6f4fe]" : "border-border"}`}>
                  <input type="radio" name="seg" checked={segmento === s.id} onChange={() => setSegmento(s.id)} className="mt-1" />
                  <span>
                    <span className="block text-[13.5px] font-bold">{s.label}</span>
                    <span className="block text-[12px] text-ink-soft">{s.dica}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {(audTipo === "lista" || audTipo === "etiqueta") && (
            <div className="mt-3 flex flex-col gap-1.5">
              {(audTipo === "lista" ? listas : etiquetas).length === 0 ? (
                <p className="rounded-xl bg-bg px-4 py-3 text-[12.5px] text-ink-soft">
                  Você ainda não tem {audTipo === "lista" ? "listas" : "etiquetas"}.{" "}
                  <Link href={audTipo === "lista" ? "/clientes/listas" : "/clientes/etiquetas"} className="font-bold text-purple hover:underline">
                    Criar agora
                  </Link>
                </p>
              ) : (
                (audTipo === "lista" ? listas : etiquetas).map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-semibold hover:border-purple/50">
                    <input type="checkbox" checked={audIds.includes(o.id)} onChange={() => alternarId(o.id)} />
                    {o.nome}
                  </label>
                ))
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={calcular} disabled={pendente} className={`btn btn-secondary btn-md ${pendente ? "btn-loading" : ""}`}>
              Calcular quem vai receber
            </button>
            {resumo && !publicoMudou && (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="badge badge-success">{resumo.total} {resumo.total === 1 ? "cliente receberá" : "clientes receberão"}</span>
                {resumo.sem_aceite > 0 && <span className="badge badge-warn">{resumo.sem_aceite} não aceitam mensagens</span>}
                {resumo.invalido > 0 && <span className="badge badge-warn">{resumo.invalido} telefone inválido</span>}
                {resumo.duplicados > 0 && <span className="badge badge-neutral">{resumo.duplicados} repetidos</span>}
              </span>
            )}
            {publicoMudou && resumo === null && <span className="text-[12.5px] font-semibold text-amber">Calcule de novo para confirmar o público.</span>}
          </div>
        </section>

        {/* ---------- passo 2 ---------- */}
        <section className="card px-5 py-5">
          <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-purple">Passo 2</p>
          <h2 className="mb-1 text-[16px] font-extrabold">A mensagem</h2>
          <p className="mb-3 text-[12.5px] text-ink-soft">
            O WhatsApp só deixa mandar para quem não falou com você nas últimas 24 horas usando um <strong>modelo aprovado pela Meta</strong>. Crie o modelo uma vez e informe o nome dele aqui.
          </p>

          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div>
              <label htmlFor="tpl">Nome do modelo aprovado</label>
              <input id="tpl" value={templateNome} onChange={(e) => setTemplateNome(e.target.value)} placeholder="ivva_sentimos_sua_falta" className="input" />
              {templateNome && nomeModeloOk !== templateNome && <p className="mt-1 text-[11.5px] text-ink-soft">Será usado como: <strong>{nomeModeloOk}</strong></p>}
            </div>
            <div>
              <label htmlFor="idioma">Idioma do modelo</label>
              <select id="idioma" value={idioma} onChange={(e) => setIdioma(e.target.value)} className="select">
                {IDIOMAS.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-bg px-4 py-3">
            <input type="checkbox" className="toggle mt-0.5" checked={usaNome} onChange={(e) => setUsaNome(e.target.checked)} />
            <span className="text-[13px] leading-snug">
              <strong>O modelo usa o primeiro nome do cliente</strong>
              <span className="block text-[12px] text-ink-soft">Marque se o texto do modelo tem a variável {"{{1}}"}. Ela é trocada pelo primeiro nome de cada cliente.</span>
            </span>
          </label>

          <label htmlFor="previa" className="mt-3">Texto do modelo (para a prévia e para você copiar na Meta)</label>
          <textarea id="previa" value={previa} onChange={(e) => setPrevia(e.target.value)} rows={4} maxLength={1024} className="textarea" placeholder="Oi, {{1}}! ..." />

          <details className="mt-3 rounded-xl border border-border bg-bg px-4 py-3">
            <summary className="cursor-pointer text-[12.5px] font-bold text-purple">Como criar este modelo na Meta (leva poucos minutos)</summary>
            <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-[12.5px] leading-snug text-ink-soft">
              <li>Abra o Gerenciador do WhatsApp (business.facebook.com), em <strong>Modelos de mensagem</strong>, e clique em <strong>Criar modelo</strong>.</li>
              <li>Categoria <strong>Marketing</strong>. Idioma igual ao escolhido acima.</li>
              <li>Nome do modelo: <strong>{nomeModeloOk || "o nome acima"}</strong> (exatamente assim).</li>
              <li>Corpo: copie o texto da caixa acima. Se usar {"{{1}}"}, informe um exemplo de nome, como &ldquo;Maria&rdquo;.</li>
              <li>Envie para aprovação. Costuma levar de alguns minutos a 1 dia. Só depois de aprovado a campanha consegue enviar.</li>
            </ol>
          </details>
        </section>

        {/* ---------- passo 3 ---------- */}
        <section className="card px-5 py-5">
          <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-purple">Passo 3</p>
          <h2 className="mb-3 flex items-center gap-2 text-[16px] font-extrabold">
            <ShieldCheck size={18} className="text-teal" /> Autorização e envio
          </h2>

          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 ${consentimento ? "border-teal/40 bg-[#e3f4ef]" : "border-border bg-bg"} ${!resumo || publicoMudou ? "opacity-60" : ""}`}>
            <input type="checkbox" className="toggle mt-0.5" checked={consentimento} disabled={!resumo || publicoMudou || pendente} onChange={(e) => alternarConsentimento(e.target.checked)} />
            <span className="text-[13px] leading-snug">
              <strong>Confirmo que estes clientes aceitaram receber mensagens do meu negócio no WhatsApp.</strong>
              <span className="block text-[12px] text-ink-soft">Mandar para quem não autorizou pode fazer o WhatsApp bloquear o seu número. Quem pedir para parar é respeitado automaticamente.</span>
            </span>
          </label>

          <div className="mt-4">
            <label htmlFor="agendar" className="flex items-center gap-1.5">
              <CalendarClock size={14} /> Agendar (opcional)
            </label>
            <input id="agendar" type="datetime-local" value={agendar} onChange={(e) => setAgendar(e.target.value)} className="input max-w-[260px]" />
            <p className="mt-1 text-[11.5px] text-ink-soft">Campanhas agendadas saem na rotina diária do sistema (por volta das 10h) a partir da data escolhida. Sem agendamento, o envio começa na hora.</p>
          </div>

          {!whatsappAtivo && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#fdf0dc] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#7a4a00]">
              <CircleAlert size={15} /> O WhatsApp não está conectado.{" "}
              <Link href="/canais" className="underline">Conectar agora</Link>
            </p>
          )}
          {erro && <p role="alert" className="shake mt-4 rounded-xl border border-coral/25 bg-[#fdece9] px-3.5 py-2.5 text-[13px] font-semibold text-[#8f2a1c]">{erro}</p>}

          {!confirmando ? (
            <button type="button" disabled={!podeIniciar || pendente} onClick={() => setConfirmando(true)} className="btn btn-primary btn-lg mt-5">
              <Rocket size={16} /> Revisar e iniciar
            </button>
          ) : (
            <div className="mt-5 rounded-xl border border-purple/30 bg-[#f6f4fe] px-4 py-4">
              <p className="text-[14px] font-extrabold">Enviar para {resumo?.total} {resumo?.total === 1 ? "cliente" : "clientes"}?</p>
              <p className="mt-1 text-[12.5px] text-ink-soft">
                {agendar ? `Fica agendada para ${new Date(agendar).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.` : "O envio começa agora."} Você poderá pausar ou cancelar a qualquer momento. Depois de enviadas, as mensagens não podem ser desfeitas.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={comecar} disabled={pendente} className={`btn btn-primary btn-md ${pendente ? "btn-loading" : ""}`}>
                  <CheckCircle2 size={15} /> Sim, iniciar envio
                </button>
                <button type="button" onClick={() => setConfirmando(false)} disabled={pendente} className="btn btn-ghost btn-md">
                  Voltar
                </button>
              </div>
            </div>
          )}
          {!podeIniciar && (
            <p className="mt-3 text-[12px] text-ink-faint">
              Para iniciar: {[!whatsappAtivo && "conectar o WhatsApp", !nomeModeloOk && "informar o modelo", (!resumo || publicoMudou) && "calcular o público", !consentimento && "confirmar a autorização"].filter(Boolean).join(", ")}.
            </p>
          )}
        </section>
      </div>

      {/* ---------- prévia ---------- */}
      <aside className="lg:sticky lg:top-20">
        <p className="mb-3 text-center text-[12px] font-bold uppercase tracking-wide text-ink-faint">Como o cliente vai ver</p>
        <PreviewWhatsApp texto={corpoModelo} negocio={negocio} />
        <button type="button" onClick={() => salvar().then((ok) => ok && setErro(null))} className="btn btn-ghost btn-sm mx-auto mt-4 flex" disabled={pendente}>
          Salvar rascunho
        </button>
      </aside>
    </div>
  );
}

import { FileUp, Lightbulb, Mic, PenLine, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { confirmarSugestaoConhecimento, ignorarSugestaoConhecimento } from "./actions";
import { criarBloco, organizarAutomaticamente } from "./blocos-actions";
import { CATEGORIAS, LIMITE_TEXTO_LONGO, type CategoriaId } from "@/lib/blocos-conhecimento";
import UploadArquivo from "./upload-arquivo";
import LerSite from "./ler-site";
import { Globe } from "lucide-react";
import EntrevistaAudio from "./entrevista-audio";
import ArquivoItem from "./arquivo-item";
import NichoSeletor from "./nicho-seletor";
import BlocoCard, { type EntradaBloco } from "./bloco-card";
import DividirTexto from "./dividir-texto";

export default async function BaseConhecimentoPage() {
  const supabase = await createClient();

  const [{ data: entradas }, { data: arquivos }, { data: sugestoes }, { data: tenant }] = await Promise.all([
    supabase.from("knowledge_base").select("id, conteudo, categoria, created_at").order("created_at", { ascending: true }),
    supabase
      .from("knowledge_files")
      .select("id, nome_arquivo, storage_path, tamanho_bytes, status, erro, entradas_geradas, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("knowledge_base_sugestoes")
      .select("id, pergunta_cliente, conteudo_sugerido, created_at")
      .eq("confirmado", false)
      .order("created_at", { ascending: false }),
    supabase.from("tenants").select("segmento").maybeSingle(),
  ]);

  const arquivosComUrl = await Promise.all(
    (arquivos ?? []).map(async (a) => {
      const { data } = await supabase.storage.from("base-conhecimento").createSignedUrl(a.storage_path, 60 * 10);
      return { ...a, urlDownload: data?.signedUrl ?? null };
    }),
  );

  const todas = entradas ?? [];
  const longos = todas.filter((e) => e.conteudo.length > LIMITE_TEXTO_LONGO);
  const curtas = todas.filter((e) => e.conteudo.length <= LIMITE_TEXTO_LONGO);

  const porTema = new Map<CategoriaId, EntradaBloco[]>();
  const semTema: EntradaBloco[] = [];
  for (const e of curtas) {
    const item = { id: e.id, conteudo: e.conteudo };
    if (e.categoria && CATEGORIAS.some((c) => c.id === e.categoria)) {
      const k = e.categoria as CategoriaId;
      porTema.set(k, [...(porTema.get(k) ?? []), item]);
    } else semTema.push(item);
  }
  const temasPreenchidos = CATEGORIAS.filter((c) => (porTema.get(c.id)?.length ?? 0) > 0).length;

  return (
    <div>
      {/* ---- cabeçalho ---- */}
      <section className="page-hero mb-5">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-[620px]">
            <h1 className="text-[24px] font-extrabold text-white">Base de conhecimento</h1>
            <p className="mt-1 text-[13.5px] text-white/75">
              Tudo o que o robô sabe sobre o seu negócio, em blocos fáceis de atualizar. Quanto mais completo, melhor ele atende.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur">
              <p className="text-[22px] font-extrabold leading-none text-white">{curtas.length}</p>
              <p className="mt-1 text-[11.5px] font-semibold text-white/70">itens</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur">
              <p className="text-[22px] font-extrabold leading-none text-white">
                {temasPreenchidos}/{CATEGORIAS.length}
              </p>
              <p className="mt-1 text-[11.5px] font-semibold text-white/70">blocos com conteúdo</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- passo 1: nicho ---- */}
      <NichoSeletor segmentoAtual={tenant?.segmento ?? null} totalItens={curtas.length} />

      {/* ---- texto corrido ---- */}
      {longos.map((l) => (
        <DividirTexto key={l.id} id={l.id} tamanho={l.conteudo.length} />
      ))}

      {/* ---- sugestões vindas do SAC ---- */}
      {sugestoes && sugestoes.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-extrabold text-purple">
            <Lightbulb size={16} /> Sugestões vindas do SAC
            <span className="font-medium text-ink-faint">({sugestoes.length}): geradas quando um humano resolveu algo que o robô não sabia</span>
          </p>
          <div className="flex flex-col gap-2">
            {sugestoes.map((s) => (
              <div key={s.id} className="card flex flex-col gap-2 border-purple/30 bg-[#f6f4fe] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  {s.pergunta_cliente && <p className="mb-1 text-[11.5px] font-semibold text-ink-faint">Cliente perguntou: {s.pergunta_cliente}</p>}
                  <p className="text-[13px] font-semibold">{s.conteudo_sugerido}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <form action={ignorarSugestaoConhecimento}>
                    <input type="hidden" name="sugestao_id" value={s.id} />
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Ignorar
                    </button>
                  </form>
                  <form action={confirmarSugestaoConhecimento}>
                    <input type="hidden" name="sugestao_id" value={s.id} />
                    <button type="submit" className="btn btn-primary btn-sm">
                      Adicionar à base
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- passo 2: outras formas de preencher ---- */}
      <section className="mb-6">
        <h2 className="mb-1 text-[15px] font-extrabold">Complete do seu jeito</h2>
        <p className="mb-3 text-[12.5px] text-ink-soft">Escreva, envie um arquivo ou simplesmente fale. A ivva organiza tudo nos blocos certos.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card px-5 py-5">
            <p className="mb-1 flex items-center gap-2 text-[14px] font-extrabold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ece9fc] text-purple">
                <PenLine size={16} />
              </span>
              Escrever
            </p>
            <p className="mb-3 text-[12px] text-ink-soft">Uma informação por vez. Ex: “Corte + barba custa R$ 80 e leva 40 minutos.”</p>
            <form action={criarBloco} className="flex flex-col gap-2">
              <textarea name="conteudo" required rows={3} placeholder="Escreva aqui…" className="resize-none rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[13px]" />
              <button type="submit" className="btn btn-primary btn-md self-start">
                Adicionar
              </button>
            </form>
          </div>
          <div className="card px-5 py-5">
            <p className="mb-1 flex items-center gap-2 text-[14px] font-extrabold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e3f4ef] text-teal">
                <FileUp size={16} />
              </span>
              Subir arquivo
            </p>
            <p className="mb-3 text-[12px] text-ink-soft">Tabela de preços (.csv), catálogo em PDF ou documento Word (.docx). A ivva lê e separa os fatos para você revisar.</p>
            <UploadArquivo />
          </div>
          <div className="card px-5 py-5">
            <p className="mb-1 flex items-center gap-2 text-[14px] font-extrabold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fdece9] text-coral">
                <Mic size={16} />
              </span>
              Falar
            </p>
            <p className="mb-3 text-[12px] text-ink-soft">Prefere contar do que escrever? Grave um áudio falando do negócio.</p>
            <EntrevistaAudio />
          </div>
        </div>
        <div className="card mt-4 px-5 py-5">
          <p className="mb-1 flex items-center gap-2 text-[14px] font-extrabold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ece9fc] text-purple">
              <Globe size={16} />
            </span>
            Ler meu site
          </p>
          <p className="mb-3 text-[12px] text-ink-soft">Já tem um site com serviços, preços e horários? A ivva lê a página e sugere os itens da base para você revisar.</p>
          <LerSite />
        </div>
      </section>

      {/* ---- blocos ---- */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-extrabold">Seus blocos</h2>
            <p className="text-[12.5px] text-ink-soft">Clique num bloco para abrir, editar ou mover itens entre blocos.</p>
          </div>
          {semTema.length > 0 && (
            <form action={organizarAutomaticamente}>
              <button type="submit" className="btn btn-secondary btn-md">
                <Wand2 size={15} /> Organizar {semTema.length} {semTema.length === 1 ? "item" : "itens"} automaticamente
              </button>
            </form>
          )}
        </div>

        {curtas.length === 0 ? (
          <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
            Sua base está vazia. Escolha o seu nicho acima para começar com um modelo pronto.
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {semTema.length > 0 && (
              <div className="lg:col-span-2">
                <BlocoCard categoria="outros" entradas={semTema} rotulo="Sem bloco ainda" dica="Itens que ainda não foram organizados por tema" />
              </div>
            )}
            {CATEGORIAS.map((c) => (
              <BlocoCard key={c.id} categoria={c.id} entradas={porTema.get(c.id) ?? []} />
            ))}
          </div>
        )}
      </section>

      {arquivosComUrl.length > 0 && (
        <section className="mt-6">
          <p className="mb-2 text-[13px] font-extrabold text-ink-soft">Arquivos enviados</p>
          <div className="flex flex-col gap-2">
            {arquivosComUrl.map((a) => (
              <ArquivoItem
                key={a.id}
                id={a.id}
                nomeArquivo={a.nome_arquivo}
                tamanhoBytes={a.tamanho_bytes}
                status={a.status}
                erro={a.erro}
                entradasGeradas={a.entradas_geradas}
                createdAt={a.created_at}
                urlDownload={a.urlDownload}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

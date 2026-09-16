import { createClient } from "@/lib/supabase/server";
import { criarEntrada, removerEntrada } from "./actions";
import UploadArquivo from "./upload-arquivo";
import EntrevistaAudio from "./entrevista-audio";

export default async function BaseConhecimentoPage() {
  const supabase = await createClient();

  const { data: entradas } = await supabase
    .from("knowledge_base")
    .select("id, conteudo, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold">
          Base de conhecimento
        </h1>
        <p className="text-[13.5px] text-ink-soft">
          O que a ivva sabe sobre o seu negócio — serviços, preços,
          políticas, perguntas frequentes. Cada item vira contexto pro
          robô responder o cliente.
        </p>
      </div>

      <form action={criarEntrada} className="card mb-5 flex gap-2 px-4 py-4">
        <textarea
          name="conteudo"
          required
          rows={2}
          placeholder="Ex: Corte + barba custa R$ 80 e leva 40 minutos. Cancelamento gratuito até 2h antes."
          className="flex-1 resize-none rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[13px]"
        />
        <button
          type="submit"
          className="btn h-fit bg-ink px-5 py-2.5 text-[13px] text-white"
        >
          + Adicionar
        </button>
      </form>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <div className="card px-5 py-5">
          <p className="mb-1 text-[14px] font-bold">Subir arquivo</p>
          <p className="mb-3 text-[12px] text-ink-faint">
            Planilha de preços (.csv) ou catálogo em PDF — a ivva lê e separa
            os fatos importantes pra você revisar antes de salvar.
          </p>
          <UploadArquivo />
        </div>
        <div className="card px-5 py-5">
          <p className="mb-1 text-[14px] font-bold">Entrevista por áudio</p>
          <p className="mb-3 text-[12px] text-ink-faint">
            Prefere falar a escrever? Grave contando sobre o negócio.
          </p>
          <EntrevistaAudio />
        </div>
      </div>

      {!entradas || entradas.length === 0 ? (
        <div className="card px-6 py-14 text-center text-[13px] text-ink-faint">
          Nenhum item ainda. Comece adicionando os serviços e preços do
          seu negócio.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entradas.map((e) => (
            <div
              key={e.id}
              className="card flex items-start justify-between gap-3 px-4 py-3.5"
            >
              <p className="text-[13.5px] leading-relaxed">{e.conteudo}</p>
              <form action={removerEntrada}>
                <input type="hidden" name="id" value={e.id} />
                <button
                  type="submit"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-surface-soft hover:text-coral"
                  title="Remover"
                >
                  <svg className="icon" viewBox="0 0 24 24" width="15" height="15">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

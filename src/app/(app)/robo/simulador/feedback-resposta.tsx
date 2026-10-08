"use client";

import { useState, useTransition } from "react";
import { BookOpen, Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { criarBloco } from "../../base-conhecimento/blocos-actions";

// Calibragem do robô: o dono avalia cada resposta de teste. 👎 abre um campo para dizer como deveria ter respondido,
// e isso vira um item da base de conhecimento (o robô passa a usar na próxima conversa).
export default function FeedbackResposta({ pergunta, fontes }: { pergunta: string; fontes?: string[] }) {
  const [voto, setVoto] = useState<"bom" | "ruim" | null>(null);
  const [verFontes, setVerFontes] = useState(false);
  const [correcao, setCorrecao] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    const texto = correcao.trim();
    if (!texto) return;
    const perguntaCurta = pergunta.trim().slice(0, 160);
    const fd = new FormData();
    fd.set("conteudo", `Quando o cliente perguntar algo como “${perguntaCurta}”, responda: ${texto}`.slice(0, 2000));
    iniciar(async () => {
      await criarBloco(fd);
      setSalvo(true);
    });
  }

  return (
    <div className="ml-9 mt-1 text-[11.5px] text-ink-faint">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setVoto(voto === "bom" ? null : "bom")}
          aria-pressed={voto === "bom"}
          aria-label="Resposta boa"
          className={`flex h-6 w-6 items-center justify-center rounded-md border ${voto === "bom" ? "border-teal bg-teal/10 text-teal" : "border-border hover:text-ink"}`}
        >
          <ThumbsUp size={12} />
        </button>
        <button
          type="button"
          onClick={() => setVoto(voto === "ruim" ? null : "ruim")}
          aria-pressed={voto === "ruim"}
          aria-label="Resposta ruim: corrigir"
          className={`flex h-6 w-6 items-center justify-center rounded-md border ${voto === "ruim" ? "border-coral bg-coral/10 text-coral" : "border-border hover:text-ink"}`}
        >
          <ThumbsDown size={12} />
        </button>
        {fontes && fontes.length > 0 && (
          <button
            type="button"
            onClick={() => setVerFontes((v) => !v)}
            aria-expanded={verFontes}
            className="ml-1 flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold hover:text-ink"
          >
            <BookOpen size={12} /> Base consultada
          </button>
        )}
        {voto === "bom" && <span className="font-semibold text-teal">Que bom! Continue testando outras perguntas.</span>}
      </div>

      {verFontes && fontes && (
        <div className="mt-1.5 rounded-lg border border-border bg-surface px-3 py-2">
          <p className="mb-1 font-semibold text-ink-soft">Itens da base mais ligados a essa pergunta (aproximado):</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {fontes.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {voto === "ruim" && !salvo && (
        <div className="mt-1.5 rounded-lg border border-coral/30 bg-coral/5 px-3 py-2.5">
          <label htmlFor="corrigir-resposta" className="font-semibold text-ink-soft">
            Como o robô deveria ter respondido?
          </label>
          <textarea
            id="corrigir-resposta"
            value={correcao}
            onChange={(e) => setCorrecao(e.target.value)}
            rows={3}
            maxLength={1500}
            placeholder="Escreva a resposta certa, com os seus preços e regras."
            className="mt-1 w-full resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
          <button type="button" onClick={salvar} disabled={pendente || !correcao.trim()} className="btn btn-primary btn-sm mt-1.5 disabled:opacity-60">
            {pendente ? "Salvando…" : "Salvar na base de conhecimento"}
          </button>
        </div>
      )}
      {salvo && (
        <p className="mt-1.5 flex items-center gap-1 font-semibold text-teal">
          <Check size={13} /> Salvo. O robô vai usar isso nas próximas conversas. Teste a pergunta de novo para conferir.
        </p>
      )}
    </div>
  );
}

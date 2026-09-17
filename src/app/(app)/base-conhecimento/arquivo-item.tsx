import { removerArquivo } from "./actions";

const STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  processado: { texto: "Processado", classe: "bg-teal/10 text-teal" },
  sem_fatos: { texto: "Sem fatos encontrados", classe: "bg-purple/10 text-purple" },
  erro: { texto: "Erro", classe: "bg-coral/10 text-coral" },
};

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ArquivoItem({
  id,
  nomeArquivo,
  tamanhoBytes,
  status,
  erro,
  entradasGeradas,
  createdAt,
  urlDownload,
}: {
  id: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  status: string;
  erro: string | null;
  entradasGeradas: number;
  createdAt: string;
  urlDownload: string | null;
}) {
  const statusInfo = STATUS_LABEL[status] ?? { texto: status, classe: "bg-surface-soft text-ink-faint" };

  return (
    <div className="card flex items-start justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="truncate text-[13.5px] font-bold">{nomeArquivo}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${statusInfo.classe}`}>
            {statusInfo.texto}
          </span>
        </div>
        <p className="text-[12px] text-ink-faint">
          {formatarTamanho(tamanhoBytes)} · enviado em {formatarData(createdAt)}
          {status === "processado" && entradasGeradas > 0 && (
            <> · {entradasGeradas} {entradasGeradas === 1 ? "fato salvo" : "fatos salvos"}</>
          )}
        </p>
        {erro && <p className="mt-1 text-[12px] text-coral">{erro}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {urlDownload && (
          <a
            href={urlDownload}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-soft hover:text-ink"
            title="Baixar"
          >
            <svg className="icon" viewBox="0 0 24 24" width="15" height="15">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />
            </svg>
          </a>
        )}
        <form action={removerArquivo}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-soft hover:text-coral"
            title="Remover"
          >
            <svg className="icon" viewBox="0 0 24 24" width="15" height="15">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

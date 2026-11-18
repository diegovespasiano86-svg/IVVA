"use client";

export type LinhaLista = {
  n: number;
  data: string;
  nome: string;
  whatsapp: string;
  email: string;
  negocio: string;
  origem: string;
};

const COLUNAS: [keyof LinhaLista, string][] = [
  ["n", "Ordem"],
  ["data", "Data e hora"],
  ["nome", "Nome"],
  ["whatsapp", "WhatsApp"],
  ["email", "E-mail"],
  ["negocio", "Tipo de negócio"],
  ["origem", "Origem"],
];

function celula(v: string | number) {
  const t = String(v ?? "");
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Baixa a lista como CSV com ponto e vírgula e BOM, que o Excel em português abre direto com os acentos certos. */
export default function BaixarLista({ linhas }: { linhas: LinhaLista[] }) {
  function baixar() {
    const cab = COLUNAS.map(([, t]) => t).join(";");
    const corpo = linhas.map((l) => COLUNAS.map(([k]) => celula(l[k])).join(";"));
    const blob = new Blob(["\uFEFF" + [cab, ...corpo].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lista-60-dias-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <button type="button" onClick={baixar} disabled={linhas.length === 0} className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">
      Baixar para o Excel
    </button>
  );
}

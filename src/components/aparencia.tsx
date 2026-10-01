"use client";

import { useState } from "react";
import { Check } from "lucide-react";

// Preferências de aparência de quem está usando (guardadas só neste navegador).
// O atributo é aplicado no <html> antes da tela aparecer (ver layout raiz), sem piscar.
const CORES = [
  { id: "roxo", nome: "Roxo (padrão)", cor: "#6d5be0" },
  { id: "azul", nome: "Azul", cor: "#2563eb" },
  { id: "verde", nome: "Verde", cor: "#0b7a64" },
  { id: "rosa", nome: "Rosa", cor: "#c2255c" },
  { id: "laranja", nome: "Laranja", cor: "#c2410c" },
  { id: "grafite", nome: "Grafite", cor: "#3f3a4c" },
] as const;

function guardar(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento: a escolha vale só até recarregar */
  }
}

export default function Aparencia() {
  const [cor, setCor] = useState<string>(() => document.documentElement.getAttribute("data-accent") ?? "roxo");
  const [compacto, setCompacto] = useState<boolean>(() => document.documentElement.getAttribute("data-density") === "compact");

  function escolherCor(id: string) {
    setCor(id);
    if (id === "roxo") document.documentElement.removeAttribute("data-accent");
    else document.documentElement.setAttribute("data-accent", id);
    guardar("ivva:cor", id === "roxo" ? null : id);
  }

  function alternarDensidade(v: boolean) {
    setCompacto(v);
    if (v) document.documentElement.setAttribute("data-density", "compact");
    else document.documentElement.removeAttribute("data-density");
    guardar("ivva:densidade", v ? "compact" : null);
  }

  return (
    <div className="border-t border-border px-3 pb-2 pt-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Aparência</p>
      <div className="flex gap-2" role="radiogroup" aria-label="Cor de destaque">
        {CORES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={cor === c.id}
            aria-label={c.nome}
            title={c.nome}
            onClick={() => escolherCor(c.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white ring-offset-2 transition-transform hover:scale-110 focus-visible:ring-2 aria-checked:ring-2"
            style={{ background: c.cor, ["--tw-ring-color" as string]: c.cor }}
          >
            {cor === c.id && <Check size={14} strokeWidth={3} />}
          </button>
        ))}
      </div>
      <div className="segmented mt-3 w-full" role="group" aria-label="Densidade das tabelas">
        <button type="button" aria-selected={!compacto} onClick={() => alternarDensidade(false)} className="flex-1">
          Confortável
        </button>
        <button type="button" aria-selected={compacto} onClick={() => alternarDensidade(true)} className="flex-1">
          Compacta
        </button>
      </div>
    </div>
  );
}

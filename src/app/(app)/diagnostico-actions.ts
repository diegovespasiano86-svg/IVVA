"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS_DIAGNOSTICO, erroDaEtapa, PRIORIDADES, type Respostas } from "@/lib/diagnostico";
import { gerarESalvarRelatorio } from "@/lib/diagnostico-servidor";

const IDS = new Set(ETAPAS_DIAGNOSTICO.flatMap((e) => e.perguntas.map((p) => p.id)).concat("prioridades"));

/** Mantém só as perguntas conhecidas, com tamanho limitado. */
function limpar(r: Respostas): Respostas {
  const out: Respostas = {};
  for (const [k, v] of Object.entries(r ?? {})) {
    if (!IDS.has(k)) continue;
    if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === "string").slice(0, 12).map((x) => x.slice(0, 120));
    else if (typeof v === "string") out[k] = v.slice(0, 1500);
  }
  if (Array.isArray(out.prioridades)) out.prioridades = out.prioridades.filter((p) => (PRIORIDADES as readonly string[]).includes(p));
  return out;
}

/** Salva o diagnóstico a cada etapa. Ao enviar, libera o sistema e pede o relatório à IA em segundo plano. */
export async function salvarDiagnostico(respostas: Respostas, etapa: number, enviar: boolean): Promise<{ erro: string | null }> {
  const r = limpar(respostas);
  if (enviar) {
    for (const e of ETAPAS_DIAGNOSTICO) {
      const erro = erroDaEtapa(e, r);
      if (erro) return { erro };
    }
  }
  const supabase = await createClient();
  const { data: tenantId, error } = await supabase.rpc("diagnostico_salvar", { p_respostas: r, p_etapa: etapa, p_enviar: enviar });
  if (error) {
    console.error("[diagnostico] salvar falhou", error.message);
    return { erro: "Não consegui salvar agora. Confira a internet e tente de novo." };
  }
  if (enviar && tenantId) {
    after(() => gerarESalvarRelatorio(String(tenantId)));
    revalidatePath("/", "layout");
  }
  return { erro: null };
}

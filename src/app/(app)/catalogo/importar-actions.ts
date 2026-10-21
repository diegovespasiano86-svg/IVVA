"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { temRecurso } from "@/lib/planos";
import { montarLinha, type LinhaItem } from "@/lib/catalogo-importacao";

export type ResultadoImportacaoItens = {
  ok: boolean;
  erro?: string;
  inseridos: number;
  jaExistiam: number;
  invalidos: number;
  repetidosNoArquivo: number;
  comEstoque: number;
  estoqueIgnorado: boolean;
};

const MAX_LINHAS = 500;
const chave = (tipo: string, nome: string) => `${tipo}|${nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()}`;

/**
 * Importa serviços, produtos e insumos. Tudo é REVALIDADO aqui (o navegador não é confiável):
 * itens com o mesmo nome e tipo já cadastrados são pulados, e o saldo inicial entra como
 * movimentação "Estoque inicial" para ficar no histórico, igual ao cadastro manual.
 */
export async function importarItens(linhas: Record<string, string>[]): Promise<ResultadoImportacaoItens> {
  const vazio = { inseridos: 0, jaExistiam: 0, invalidos: 0, repetidosNoArquivo: 0, comEstoque: 0, estoqueIgnorado: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo.", ...vazio };
  const { data: perfil } = await supabase.from("users").select("tenant_id, role, tenants(plano)").eq("id", user.id).maybeSingle();
  if (!perfil) return { ok: false, erro: "Não encontramos o seu negócio.", ...vazio };
  if (perfil.role !== "dono") return { ok: false, erro: "Só o administrador importa itens no catálogo.", ...vazio };
  if (!Array.isArray(linhas) || linhas.length === 0) return { ok: false, erro: "Nenhuma linha para importar.", ...vazio };
  if (linhas.length > MAX_LINHAS) return { ok: false, erro: `Máximo de ${MAX_LINHAS} itens por vez. Divida o arquivo em partes.`, ...vazio };

  const estoqueLiberado = temRecurso((perfil.tenants as unknown as { plano: string } | null)?.plano, "estoque");

  const validas: LinhaItem[] = [];
  const vistos = new Set<string>();
  let invalidos = 0;
  let repetidosNoArquivo = 0;
  for (const bruta of linhas) {
    const l = montarLinha(bruta ?? {});
    if (!l) {
      invalidos++;
      continue;
    }
    const k = chave(l.tipo, l.nome);
    if (vistos.has(k)) {
      repetidosNoArquivo++;
      continue;
    }
    vistos.add(k);
    validas.push(l);
  }

  const { data: existentes } = await supabase.from("products").select("nome, tipo").limit(10000);
  const jaTem = new Set((existentes ?? []).map((p) => chave(p.tipo, p.nome)));
  const novas = validas.filter((l) => !jaTem.has(chave(l.tipo, l.nome)));
  const jaExistiam = validas.length - novas.length;
  if (novas.length === 0) return { ok: true, ...vazio, jaExistiam, invalidos, repetidosNoArquivo };

  const { data: criados, error } = await supabase
    .from("products")
    .insert(
      novas.map((l) => ({
        tenant_id: perfil.tenant_id,
        tipo: l.tipo,
        nome: l.nome,
        categoria: l.categoria || null,
        preco: l.preco,
        custo: l.custo,
        // Controla saldo quando o plano permite e a planilha traz estoque ou mínimo.
        controla_estoque: estoqueLiberado && l.tipo !== "servico" && (l.estoque > 0 || l.minimo > 0),
        estoque_atual: 0,
        estoque_minimo: estoqueLiberado ? l.minimo : 0,
        duracao_minutos: l.duracao,
      })),
    )
    .select("id, nome, tipo");
  if (error || !criados) {
    console.error("[catalogo-importar] insert falhou", error?.message);
    return { ok: false, erro: "Não consegui importar agora. Nada foi gravado; tente de novo.", ...vazio, jaExistiam, invalidos, repetidosNoArquivo };
  }

  // Saldo inicial pela função de movimentação: grava o histórico e mantém o saldo coerente.
  const porChave = new Map(criados.map((c) => [chave(c.tipo, c.nome), c.id as string]));
  const comSaldo = novas.filter((l) => estoqueLiberado && l.estoque > 0 && porChave.has(chave(l.tipo, l.nome)));
  let comEstoque = 0;
  for (let i = 0; i < comSaldo.length; i += 10) {
    const resultados = await Promise.all(
      comSaldo.slice(i, i + 10).map((l) =>
        supabase.rpc("estoque_movimentar", { p_product_id: porChave.get(chave(l.tipo, l.nome)), p_delta: l.estoque, p_tipo: "entrada", p_motivo: "Estoque inicial (importação)" }),
      ),
    );
    comEstoque += resultados.filter((r) => !r.error).length;
  }

  revalidatePath("/catalogo");
  revalidatePath("/checkout");
  return {
    ok: true,
    inseridos: criados.length,
    jaExistiam,
    invalidos,
    repetidosNoArquivo,
    comEstoque,
    estoqueIgnorado: !estoqueLiberado && novas.some((l) => l.estoque > 0),
  };
}

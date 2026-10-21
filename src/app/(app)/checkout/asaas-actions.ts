"use server";

import { createClient } from "@/lib/supabase/server";
import { criarLinkPagamento, criarPixEstatico, lerContaAsaas } from "@/lib/asaas";
import type { DadosPagamento } from "./actions";
import { gravarCobranca, prepararCobranca, type RetornoCobranca } from "./cobranca-comum";

export type { CobrancaCriada, RetornoCobranca } from "./cobranca-comum";

/** Gera a cobrança no Asaas do negócio (Pix QR Code ou link de Pix/cartão). A venda só é registrada quando o Asaas avisar o pagamento. */
export async function criarCobrancaAsaas(dados: Omit<DadosPagamento, "forma">, modo: "pix" | "link"): Promise<RetornoCobranca> {
  const p = await prepararCobranca(dados);
  if ("erro" in p) return { erro: p.erro };

  const conta = await lerContaAsaas(p.tenantId).catch(() => null);
  if (!conta) return { erro: "Conecte a sua conta Asaas em Integrações para cobrar por aqui." };

  let asaasId: string;
  let url: string | null = null;
  let copiaECola: string | null = null;
  let imagem: string | null = null;
  try {
    if (modo === "pix") {
      const r = await criarPixEstatico(conta, p.valor, p.resumo);
      asaasId = r.id;
      copiaECola = r.copiaECola;
      imagem = r.imagem;
    } else {
      const r = await criarLinkPagamento(conta, p.valor, `Pedido ${new Date().toLocaleDateString("pt-BR")}`, p.resumo);
      asaasId = r.id;
      url = r.url;
    }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não consegui gerar a cobrança agora." };
  }

  const g = await gravarCobranca(dados, p, modo, asaasId, url, copiaECola);
  if ("erro" in g) return { erro: g.erro };
  return { erro: null, cobranca: { id: g.id, modo, valor: p.valor, url, copiaECola, imagem } };
}

/** Situação da cobrança (para a tela mostrar "pago" sozinha). Só lê cobranças do próprio negócio. */
export async function statusCobranca(id: string): Promise<{ status: string; erro: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase.from("cobrancas").select("status, erro").eq("id", id).maybeSingle();
  return { status: data?.status ?? "desconhecida", erro: data?.erro ?? null };
}

"use server";

import { randomUUID } from "node:crypto";
import { criarLinkMP, criarOrdemPointMP, criarPixMP, lerContaMP } from "@/lib/mercadopago";
import type { DadosPagamento } from "./actions";
import { cancelarCobranca, completarCobranca, gravarCobranca, prepararCobranca, type RetornoCobranca } from "./cobranca-comum";

/**
 * Gera a cobrança no Mercado Pago do negócio: Pix, link (Pix/cartão) ou direto na maquininha Point.
 * A cobrança nasce primeiro (o id dela vira external_reference no Mercado Pago) e depois recebe o id do provedor.
 * A venda só é registrada quando o Mercado Pago avisar o pagamento.
 */
export async function criarCobrancaMercadoPago(dados: Omit<DadosPagamento, "forma">, modo: "pix" | "link" | "maquininha"): Promise<RetornoCobranca> {
  const p = await prepararCobranca(dados);
  if ("erro" in p) return { erro: p.erro };

  const conta = await lerContaMP(p.tenantId).catch(() => null);
  if (!conta) return { erro: "Conecte a sua conta Mercado Pago em Integrações para cobrar por aqui." };

  const provisorio = `pendente:${randomUUID()}`;
  const g = await gravarCobranca(dados, p, modo, provisorio, null, null);
  if ("erro" in g) return { erro: g.erro };

  let externo: string;
  let url: string | null = null;
  let copiaECola: string | null = null;
  let imagem: string | null = null;
  try {
    if (modo === "pix") {
      const r = await criarPixMP(conta, p.valor, p.resumo, g.id, `cliente+${g.id.slice(0, 8)}@ivva.app.br`);
      externo = r.id;
      copiaECola = r.copiaECola;
      imagem = r.imagem;
    } else if (modo === "link") {
      const r = await criarLinkMP(conta, p.valor, p.resumo, g.id);
      externo = r.id;
      url = r.url;
    } else {
      const r = await criarOrdemPointMP(conta, p.valor, p.resumo, g.id);
      externo = r.id;
    }
  } catch (e) {
    await cancelarCobranca(provisorio);
    return { erro: e instanceof Error ? e.message : "Não consegui gerar a cobrança agora." };
  }

  await completarCobranca(g.id, "mercadopago", externo, url, copiaECola);
  return { erro: null, cobranca: { id: g.id, modo, valor: p.valor, url, copiaECola, imagem } };
}

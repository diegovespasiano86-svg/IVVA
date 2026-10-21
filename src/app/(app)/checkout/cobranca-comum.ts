import { createClient as createAnon } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { DadosPagamento } from "./actions";

// Parte comum da cobrança por provedor (Asaas, Mercado Pago): valida o carrinho, acha ou cadastra o cliente e grava a cobrança.

export type CobrancaCriada = { id: string; modo: "pix" | "link" | "maquininha"; valor: number; url: string | null; copiaECola: string | null; imagem: string | null };
export type RetornoCobranca = { erro: string | null; cobranca?: CobrancaCriada };

function normalizarTelefone(bruto: string): string | null {
  const d = bruto.replace(/\D/g, "");
  const sem55 = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  return sem55.length === 10 || sem55.length === 11 ? "55" + sem55 : null;
}

export type Preparo = { tenantId: string; contactId: string; valor: number; desconto: number; resumo: string };

export async function prepararCobranca(dados: Omit<DadosPagamento, "forma">): Promise<{ erro: string } | Preparo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada, faça login de novo." };
  const { data: perfil } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!perfil) return { erro: "Não encontramos o seu negócio." };

  if (!Array.isArray(dados.itens) || dados.itens.length === 0) return { erro: "Adicione pelo menos um item." };
  if (dados.itens.length > 50) return { erro: "Itens demais no mesmo carrinho." };
  let bruto = 0;
  for (const i of dados.itens) {
    if (!i.nome?.trim()) return { erro: "Todo item precisa de um nome." };
    if (!(i.qtd >= 1 && i.qtd <= 9999) || !(i.preco >= 0 && i.preco <= 1_000_000)) return { erro: "Confira a quantidade e o preço dos itens." };
    bruto += Math.round(i.qtd * i.preco * 100) / 100;
  }
  const desconto = Math.max(0, dados.desconto || 0);
  if (desconto > bruto) return { erro: "O desconto não pode ser maior que o total." };
  const valor = Math.round((bruto - desconto) * 100) / 100;
  if (valor <= 0) return { erro: "O total precisa ser maior que zero." };

  // Cliente: escolhido ou novo (cadastrado agora), como no registro manual.
  let contactId = dados.contactId;
  if (!contactId) {
    const nome = dados.novoCliente?.nome?.trim() ?? "";
    const telefone = normalizarTelefone(dados.novoCliente?.telefone ?? "");
    if (!nome) return { erro: "Escolha o cliente ou informe o nome do novo cliente." };
    if (!telefone) return { erro: "Informe o WhatsApp do cliente com DDD." };
    const { data: existente } = await supabase.from("contacts").select("id").eq("telefone", telefone).maybeSingle();
    if (existente) contactId = existente.id;
    else {
      const { data: criado, error } = await supabase
        .from("contacts")
        .insert({ tenant_id: perfil.tenant_id, nome, telefone, tipo_relacionamento: "cliente" })
        .select("id")
        .single();
      if (error || !criado) return { erro: "Não consegui cadastrar o cliente agora. Tente de novo." };
      contactId = criado.id;
    }
  }

  const resumo = dados.itens.map((i) => `${i.qtd}x ${i.nome.trim()}`).join(", ");
  return { tenantId: perfil.tenant_id, contactId: contactId as string, valor, desconto, resumo };
}

function servidorAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) return null;
  return { supabase: createAnon(url, anon), secret };
}

/** Grava a cobrança. `externo` é o id no provedor (ou um provisório, quando o id só existe depois da chamada ao provedor). */
export async function gravarCobranca(
  dados: Omit<DadosPagamento, "forma">,
  p: Preparo,
  forma: "pix" | "link" | "maquininha",
  externo: string,
  url: string | null,
  pix: string | null,
): Promise<{ id: string } | { erro: string }> {
  const s = servidorAnon();
  if (!s) return { erro: "Cobrança indisponível no momento." };
  const { data: id, error } = await s.supabase.rpc("cobranca_criar", {
    p_secret: s.secret,
    p_tenant: p.tenantId,
    p_contact: p.contactId,
    p_professional: dados.professionalId || null,
    p_appointment: dados.appointmentId || null,
    p_conversation: null,
    p_itens: dados.itens.map((i) => ({ product_id: i.productId, nome: i.nome.trim(), qtd: i.qtd, preco_unit: i.preco })),
    p_desconto: p.desconto,
    p_valor: p.valor,
    p_forma: forma,
    p_origem: "checkout",
    p_asaas_id: externo,
    p_url: url,
    p_pix: pix,
  });
  if (error || !id) {
    console.error("[checkout] cobranca_criar falhou", error?.message);
    return { erro: "A cobrança foi gerada, mas não consegui registrá-la aqui. Não use este código; tente de novo." };
  }
  return { id: id as string };
}

/** Completa a cobrança com o id/link/código do provedor (segunda fase) ou a cancela se o provedor recusou. */
export async function completarCobranca(id: string, provedor: string, externo: string, url: string | null, pix: string | null) {
  const s = servidorAnon();
  if (!s) return;
  await s.supabase.rpc("cobranca_externo", { p_secret: s.secret, p_id: id, p_provedor: provedor, p_externo: externo, p_url: url, p_pix: pix });
}

export async function cancelarCobranca(externoProvisorio: string) {
  const s = servidorAnon();
  if (!s) return;
  await s.supabase.rpc("cobranca_status", { p_secret: s.secret, p_asaas_id: externoProvisorio, p_status: "cancelada" });
}

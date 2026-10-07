"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarChavePix, type TipoChavePix } from "@/lib/pix";

export type ItemCarrinho = { productId: string | null; nome: string; qtd: number; preco: number };
export type DadosPagamento = {
  contactId: string | null;
  novoCliente: { nome: string; telefone: string } | null;
  professionalId: string;
  appointmentId: string | null;
  itens: ItemCarrinho[];
  forma: string;
  desconto: number;
};
export type RetornoCheckout = { erro: string | null; ok?: boolean };

function traduzirErro(msg: string): string {
  const est = msg.match(/estoque_insuficiente:(.*):(\d+)/);
  if (est) return `Estoque insuficiente de "${est[1]}" (restam ${est[2]}). Ajuste o saldo no Catálogo ou reduza a quantidade.`;
  if (msg.includes("carrinho_vazio")) return "Adicione pelo menos um item.";
  if (msg.includes("desconto_maior_que_total")) return "O desconto não pode ser maior que o total.";
  if (msg.includes("total_invalido")) return "O total precisa ser maior que zero.";
  if (msg.includes("item_invalido")) return "Confira a quantidade e o preço dos itens.";
  if (msg.includes("item_sem_nome")) return "Todo item precisa de um nome.";
  if (msg.includes("forma_invalida")) return "Escolha a forma de pagamento.";
  return "Não consegui registrar agora. Tente de novo.";
}

function normalizarTelefone(bruto: string): string | null {
  const d = bruto.replace(/\D/g, "");
  const sem55 = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  return sem55.length === 10 || sem55.length === 11 ? "55" + sem55 : null;
}

/** Registra o pagamento do carrinho (serviços + produtos). Cliente novo é cadastrado aqui mesmo. */
export async function registrarPagamentoCarrinho(dados: DadosPagamento): Promise<RetornoCheckout> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada, faça login de novo." };
  const { data: perfil } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!perfil) return { erro: "Não encontramos o seu negócio." };

  if (!dados.forma) return { erro: "Escolha a forma de pagamento." };
  if (!Array.isArray(dados.itens) || dados.itens.length === 0) return { erro: "Adicione pelo menos um item." };

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

  const { error } = await supabase.rpc("pagamento_registrar", {
    p_contact_id: contactId,
    p_professional_id: dados.professionalId || null,
    p_appointment_id: dados.appointmentId || null,
    p_itens: dados.itens.map((i) => ({ product_id: i.productId, nome: i.nome, qtd: i.qtd, preco_unit: i.preco })),
    p_forma: dados.forma,
    p_desconto: dados.desconto || 0,
  });
  if (error) return { erro: traduzirErro(error.message) };

  revalidatePath("/checkout");
  revalidatePath("/catalogo");
  revalidatePath("/dashboard");
  revalidatePath("/calendario");
  revalidatePath("/relatorios");
  revalidatePath("/clientes");
  return { erro: null, ok: true };
}

/** Estorna um pagamento (só o administrador): devolve os produtos ao estoque e guarda cópia para auditoria. */
export async function estornarPagamento(id: string): Promise<RetornoCheckout> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pagamento_estornar", { p_payment_id: id });
  if (error) return { erro: error.message.includes("somente_administrador") ? "Só o administrador pode estornar." : "Não consegui estornar agora." };
  revalidatePath("/checkout");
  revalidatePath("/catalogo");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  return { erro: null, ok: true };
}

/** Guarda a chave Pix da clínica (só o administrador). O dinheiro cai direto na conta de quem recebe. */
export async function salvarPix(_prev: RetornoCheckout, formData: FormData): Promise<RetornoCheckout> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada, faça login de novo." };
  const { data: perfil } = await supabase.from("users").select("tenant_id, role").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.role !== "dono") return { erro: "Só o administrador configura o Pix." };

  const tipo = String(formData.get("tipo_chave") ?? "documento") as TipoChavePix;
  const chave = normalizarChavePix(String(formData.get("chave") ?? ""), tipo);
  const beneficiario = String(formData.get("beneficiario") ?? "").trim();
  const cidade = String(formData.get("cidade") ?? "").trim();
  if (!chave) return { erro: "Essa chave Pix não parece válida para o tipo escolhido." };
  if (!beneficiario) return { erro: "Informe o nome de quem recebe (como aparece no banco)." };
  if (!cidade) return { erro: "Informe a cidade." };

  const { error } = await supabase
    .from("tenants")
    .update({ pix_chave: chave, pix_beneficiario: beneficiario.slice(0, 60), pix_cidade: cidade.slice(0, 40) })
    .eq("id", perfil.tenant_id);
  if (error) return { erro: "Não consegui salvar agora. Tente de novo." };
  revalidatePath("/checkout");
  return { erro: null, ok: true };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { gerarRespostaWhatsApp, type ContextoConversa } from "@/lib/ai";

export type MensagemSimulada = { remetente: "contato" | "bot"; conteudo: string };
export type RespostaSimulada = { resposta?: string; erro?: string; pediuHumano?: boolean; fontes?: string[] };

const MAX_MENSAGENS = 24;
const MAX_CARACTERES = 600;

/**
 * Conversa de teste com a IA do próprio negócio. É o MESMO motor do WhatsApp,
 * com `simulacao: true`: consultas (horários, catálogo, avisos) são reais e
 * qualquer ação que grava ou envia é bloqueada. Nada vai pro cliente.
 * O negócio vem SEMPRE da sessão de quem está logado, nunca do navegador.
 */
export async function simularResposta(historico: MensagemSimulada[]): Promise<RespostaSimulada> {
  if (!Array.isArray(historico) || historico.length === 0 || historico.length > MAX_MENSAGENS) {
    return { erro: "Conversa de teste muito longa. Clique em “Reiniciar” para começar outra." };
  }
  const limpo = historico.map((m) => ({
    remetente: m.remetente === "bot" ? ("bot" as const) : ("contato" as const),
    conteudo: String(m.conteudo ?? "").slice(0, MAX_CARACTERES),
  }));
  if (limpo[limpo.length - 1].remetente !== "contato" || !limpo[limpo.length - 1].conteudo.trim()) {
    return { erro: "Escreva uma mensagem para testar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada. Entre de novo." };

  const { data: perfil } = await supabase
    .from("users")
    .select("role, tenant_id, tenants(nome, identidade_assistente, horario_abertura, horario_fechamento)")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || perfil.role !== "dono") return { erro: "Só o dono do negócio pode usar o simulador." };

  const tenant = perfil.tenants as unknown as {
    nome: string;
    identidade_assistente: ContextoConversa["identidadeAssistente"];
    horario_abertura: string | null;
    horario_fechamento: string | null;
  } | null;
  if (!tenant) return { erro: "Negócio não encontrado." };

  const [{ data: profissionais }, { data: cfg }] = await Promise.all([
    supabase.from("professionals").select("id, nome"),
    supabase.from("bot_settings").select("indicacao_recompensa_ativo, indicacao_recompensa_texto").maybeSingle(),
  ]);

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret || !url || !anon) return { erro: "O simulador só funciona no sistema publicado (faltam configurações neste ambiente)." };

  const ctx: ContextoConversa = {
    tenantId: perfil.tenant_id,
    tenantNome: tenant.nome,
    identidadeAssistente: tenant.identidade_assistente,
    conversationId: "simulacao",
    contactId: "simulacao",
    contactNome: "Cliente de teste",
    contactIsNovo: limpo.length <= 1,
    historico: limpo,
    profissionais: profissionais ?? [],
    horarioAbertura: tenant.horario_abertura,
    horarioFechamento: tenant.horario_fechamento,
    indicacaoRecompensaAtiva: cfg?.indicacao_recompensa_ativo ?? false,
    indicacaoRecompensaTexto: cfg?.indicacao_recompensa_texto ?? null,
    simulacao: true,
  };

  // Limite diário por negócio: cada teste usa a IA (e custa).
  const { data: liberado } = await supabase.rpc("ia_registrar_uso", { p_tipo: "simulador", p_limite: 60 });
  if (liberado !== true) return { erro: "Você atingiu o limite de 60 testes por dia. Volte amanhã." };

  try {
    const r = await gerarRespostaWhatsApp(ctx, secret, url, anon);
    // "Base consultada": os itens da base mais ligados à pergunta (mesma busca que o robô usa). Aproximado; falha aqui não atrapalha.
    let fontes: string[] = [];
    try {
      const { createClient: criarCliente } = await import("@supabase/supabase-js");
      const { data: achados } = await criarCliente(url, anon).rpc("ia_consultar_catalogo", {
        p_secret: secret,
        p_tenant_id: perfil.tenant_id,
        p_busca: limpo[limpo.length - 1].conteudo,
      });
      const base = (achados as { base_conhecimento?: { conteudo?: string }[] } | null)?.base_conhecimento ?? [];
      fontes = base
        .map((b) => String(b.conteudo ?? "").trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((c) => (c.length > 160 ? c.slice(0, 157) + "…" : c));
    } catch {}
    return { resposta: r.resposta, pediuHumano: r.handoffSolicitado, fontes };
  } catch (e) {
    console.error("[simulador] falha ao gerar resposta de teste", e);
    return { erro: "Não foi possível gerar a resposta de teste agora. Tente de novo em instantes." };
  }
}

"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CONTRATO_VERSAO } from "@/lib/contrato";
import { getSegmento } from "@/lib/segmentos";
import { TESTE_GRATIS } from "@/lib/teste-gratis";

export type Ativacao = { ok: true; novo: boolean; email: string } | { ok: false; erro: string; entrar?: boolean };

/** Quem confirmou o e-mail já chega logado: monta o negócio no plano Essencial, sem cartão. */
export async function ativarTesteGratis(): Promise<Ativacao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre com o e-mail e a senha que você criou.", entrar: true };

  const { data: perfil } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
  if (perfil) return { ok: true, novo: false, email: user.email ?? "" };

  const m = (user.user_metadata ?? {}) as { nome?: string; negocio?: string; telefone?: string; segmento?: string; entrada?: string; aceite_em?: string };
  if (m.entrada !== TESTE_GRATIS.origem) return { ok: false, erro: "Este acesso não veio da página da IVVA BLACK. Fale com a gente no (11) 92740-9320." };

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return { ok: false, erro: "Configuração do servidor incompleta. Fale com a gente e informe o código CAD-2." };

  const segmento = getSegmento(m.segmento ?? "") ?? getSegmento("outro");
  const { data: tenantId, error } = await supabase.rpc("teste_gratis_criar", {
    p_secret: secret,
    p_user_id: user.id,
    p_nome_negocio: m.negocio || "Meu negócio",
    p_user_nome: m.nome || "Dono",
    p_segmento: segmento?.id ?? "outro",
    p_telefone: m.telefone ?? "",
    p_aceite_em: m.aceite_em ?? new Date().toISOString(),
    p_conhecimento: segmento?.baseConhecimento ?? null,
  });
  if (error) {
    console.error("[teste-gratis] criar", error.message);
    if (error.message.includes("ja usou")) {
      return { ok: false, erro: "Esse e-mail ou WhatsApp já usou o período grátis. Fale com a gente no (11) 92740-9320." };
    }
    return { ok: false, erro: "Seu e-mail foi confirmado, mas faltou montar o negócio. Tente de novo; se repetir, informe o código CAD-5." };
  }

  const h = await headers();
  const { error: errAceite } = await supabase.from("contrato_aceites").insert({
    user_id: user.id,
    tenant_id: tenantId,
    versao: CONTRATO_VERSAO,
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    user_agent: h.get("user-agent")?.slice(0, 400) ?? null,
  });
  if (errAceite && errAceite.code !== "23505") console.error("[teste-gratis] aceite do contrato", errAceite.message);

  return { ok: true, novo: true, email: user.email ?? "" };
}

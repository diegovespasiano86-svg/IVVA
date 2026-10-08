"use server";

import { createClient } from "@/lib/supabase/server";
import { extrairEntradasConhecimento } from "@/lib/extracao-conhecimento";
import { lerTextoDoSite } from "@/lib/ler-site";

export type LerSiteState = { entradas: string[]; erro: string | null; aviso: string | null; arquivoId: null };

const VAZIO: LerSiteState = { entradas: [], erro: null, aviso: null, arquivoId: null };

/** Lê uma página do site do negócio e devolve fatos PARA REVISÃO. Não grava nada: quem salva é a revisão do dono. */
export async function lerMeuSite(_prev: LerSiteState, formData: FormData): Promise<LerSiteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...VAZIO, erro: "Sua sessão expirou. Entre de novo." };
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (perfil?.role !== "dono") return { ...VAZIO, erro: "Só o dono do negócio pode alterar a base de conhecimento." };

  const endereco = String(formData.get("endereco") ?? "");
  if (!endereco.trim()) return { ...VAZIO, erro: "Digite o endereço do seu site." };

  const { data: liberado } = await supabase.rpc("ia_registrar_uso", { p_tipo: "ler_site", p_limite: 10 });
  if (liberado !== true) return { ...VAZIO, erro: "Você atingiu o limite diário desta função. Tente amanhã." };

  try {
    const { texto } = await lerTextoDoSite(endereco);
    const { entradas, truncado } = await extrairEntradasConhecimento({ texto });
    if (entradas.length === 0) return { ...VAZIO, erro: "Li a página, mas não encontrei fatos claros (preços, horários, serviços). Tente outra página, como a de serviços ou contato." };
    return {
      ...VAZIO,
      entradas,
      aviso: truncado ? "A página era grande e a IA parou no meio. Revise: alguns trechos podem ter ficado de fora." : null,
    };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "";
    // Mensagens de leitura já são amigáveis; as de IA ficam genéricas.
    const amigavel = /endereço|site|página|http|redirecion|Esse endereço/i.test(mensagem);
    if (!amigavel) console.error("[ler-site] falha", e);
    return { ...VAZIO, erro: amigavel ? mensagem : "Não foi possível ler o site agora. Tente de novo em instantes." };
  }
}

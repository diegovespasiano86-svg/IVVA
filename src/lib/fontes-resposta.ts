// "Fonte da resposta": os itens da base de conhecimento mais ligados à pergunta do cliente
// (mesma busca que o robô usa). Aproximado; qualquer falha devolve lista vazia e nunca atrapalha a resposta.
import { createClient } from "@supabase/supabase-js";

export async function buscarFontesDaResposta(p: {
  url: string;
  anon: string;
  secret: string;
  tenantId: string;
  pergunta: string;
}): Promise<string[]> {
  if (!p.pergunta.trim()) return [];
  try {
    const { data } = await createClient(p.url, p.anon).rpc("ia_consultar_catalogo", {
      p_secret: p.secret,
      p_tenant_id: p.tenantId,
      p_busca: p.pergunta,
    });
    const base = (data as { base_conhecimento?: { conteudo?: string }[] } | null)?.base_conhecimento ?? [];
    return base
      .map((b) => String(b.conteudo ?? "").trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((c) => (c.length > 160 ? c.slice(0, 157) + "…" : c));
  } catch {
    return [];
  }
}

import { createClient } from "@supabase/supabase-js";
import { gerarRelatorioDiagnostico, type Respostas } from "@/lib/diagnostico";

/**
 * Lê as respostas do diagnóstico de um negócio, pede o relatório à IA e grava (ou grava o erro).
 * Roda no servidor com o segredo interno; nunca lança erro (é chamado depois da resposta ao cliente).
 */
export async function gerarESalvarRelatorio(tenantId: string): Promise<{ ok: boolean; erro?: string }> {
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return { ok: false, erro: "segredo interno ausente" };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  try {
    const { data, error } = await supabase.rpc("diagnostico_para_relatorio", { p_secret: secret, p_tenant: tenantId });
    if (error || !data) throw new Error(error?.message ?? "diagnóstico não encontrado");
    const d = data as { respostas: Respostas; negocio: string; segmento: string | null; plano: string | null };
    const relatorio = await gerarRelatorioDiagnostico(d);
    const { error: erroSalvar } = await supabase.rpc("diagnostico_salvar_relatorio", { p_secret: secret, p_tenant: tenantId, p_relatorio: relatorio });
    if (erroSalvar) throw new Error(erroSalvar.message);
    return { ok: true };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("[diagnostico] relatório falhou", tenantId, erro);
    await supabase.rpc("diagnostico_salvar_relatorio", { p_secret: secret, p_tenant: tenantId, p_relatorio: null, p_erro: erro });
    return { ok: false, erro };
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { podeEnviarAutomatico } from "@/lib/automacao";
import {
  decidirAcao,
  montarNota,
  observarConversa,
  textoAvisoEncerramento,
  textoLembrete,
  textoPerguntarEncerrar,
  type LinhaPendente,
} from "@/lib/robo-humano";

// Acompanha as conversas em que o administrador entrou: observa (15 min), pergunta se pode
// encerrar (1 h), lembra (8 h) e avisa antes de encerrar (21 h da última msg do cliente).
// Chamado a cada 5 minutos pelo agendador do Supabase (pg_cron + pg_net, sem custo extra).
// Autenticação: segredo interno do WhatsApp (o mesmo do webhook) OU CRON_SECRET da Vercel.
export const maxDuration = 60;

function autorizado(request: NextRequest) {
  const interno = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  const cron = process.env.CRON_SECRET;
  const headerInterno = request.headers.get("x-internal-secret");
  const bearer = request.headers.get("authorization");
  if (interno && headerInterno && headerInterno === interno) return true;
  if (cron && bearer === `Bearer ${cron}`) return true;
  return false;
}

async function tratar(request: NextRequest) {
  if (!autorizado(request)) return new NextResponse("Unauthorized", { status: 401 });

  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return NextResponse.json({ ok: false, erro: "segredo interno ausente" });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.rpc("robo_humano_pendentes", { p_secret: secret });
  if (error) {
    console.error("[cron robo-humano] erro ao listar", error);
    return NextResponse.json({ ok: false });
  }

  const agora = new Date();
  const linhas = (data ?? []) as LinhaPendente[];
  const resumo = { analisadas: linhas.length, observadas: 0, perguntas: 0, lembretes: 0, avisos: 0, silenciosas: 0, falhas: 0 };
  const inicio = Date.now();

  async function aplicar(id: string, acao: string, dados: Record<string, unknown> = {}) {
    const { error: e } = await supabase.rpc("robo_humano_aplicar", { p_secret: secret, p_conversation_id: id, p_acao: acao, p_dados: dados });
    if (e) console.error(`[cron robo-humano] falha ao aplicar ${acao}`, e);
    return !e;
  }

  for (const l of linhas) {
    if (Date.now() - inicio > 50_000) break; // deixa o resto para a próxima rodada
    const acao = decidirAcao(l, agora);
    if (!acao) continue;

    try {
      if (acao === "observar") {
        const o = l.transcript ? await observarConversa(l.transcript) : null;
        // Sem resposta da IA: marca como revisado e segue como "aguardando", para nunca ficar em laço.
        const ok = await aplicar(l.conversation_id, "revisado", o
          ? { situacao: o.situacao, texto: montarNota(o), email: o.email, data_nascimento: o.dataNascimento }
          : { situacao: "aguardando_cliente" });
        if (ok) resumo.observadas++;
        continue;
      }

      if (acao === "encerrar_silencio") {
        if (await aplicar(l.conversation_id, "encerrar_silencio")) resumo.silenciosas++;
        continue;
      }

      // Daqui em diante manda mensagem: respeita o controle de qualidade do número.
      if (!l.phone_number_id || !l.access_token) continue;
      if (!(await podeEnviarAutomatico(supabase, secret, { tenantId: l.tenant_id, telefone: l.contact_telefone }))) continue;

      const texto =
        acao === "perguntar_encerrar" ? textoPerguntarEncerrar(l.contact_nome, l.tenant_nome)
        : acao === "lembrete" ? textoLembrete(l.contact_nome, l.tenant_nome)
        : textoAvisoEncerramento(l.contact_nome, l.tenant_nome);

      let waId: string | null = null;
      try {
        const r = await sendWhatsAppText({ phoneNumberId: l.phone_number_id, token: l.access_token }, l.contact_telefone, texto);
        waId = r?.messages?.[0]?.id ?? null;
      } catch (err) {
        // 131047 = janela de 24 h fechada: não insiste, encerra em silêncio.
        const codigo = (err as { code?: number }).code;
        if (codigo === 131047) {
          if (await aplicar(l.conversation_id, "encerrar_silencio")) resumo.silenciosas++;
        } else {
          resumo.falhas++;
          console.error("[cron robo-humano] falha ao enviar", err);
        }
        continue;
      }

      const dados = { texto, wa_message_id: waId };
      if (acao === "perguntar_encerrar" && (await aplicar(l.conversation_id, "perguntar_encerrar", dados))) resumo.perguntas++;
      else if (acao === "lembrete" && (await aplicar(l.conversation_id, "lembrete", dados))) resumo.lembretes++;
      else if (acao === "avisar_encerrar" && (await aplicar(l.conversation_id, "avisar_encerrar", dados))) resumo.avisos++;
    } catch (err) {
      resumo.falhas++;
      console.error("[cron robo-humano] erro na conversa", l.conversation_id, err);
    }
  }

  return NextResponse.json({ ok: true, ...resumo });
}

export const GET = tratar;
export const POST = tratar;

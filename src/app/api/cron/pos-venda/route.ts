import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { processarResumosPendentes } from "@/lib/resumo-conversas";
import { podeEnviarAutomatico } from "@/lib/automacao";
import { processarResumosHistoricoPendentes } from "@/lib/whatsapp-historico";

// Roda 1x por dia (limite do plano Hobby da Vercel — ver vercel.json).
// Isso significa que os prazos "1h"/"2h" na prática viram "dentro do
// mesmo dia" em vez de exatos; "1d"/"5d" continuam precisos. Precisa de
// plano Pro pra rodar de hora em hora de verdade.
// 60s pra caber o lote de resumos de conversa por IA no fim do run,
// além do resto (Hobby aceita maxDuration configurado até 60s).
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) {
    console.error("[cron pos-venda] WHATSAPP_WEBHOOK_INTERNAL_SECRET não configurado");
    return NextResponse.json({ ok: false });
  }

  const supabase = createClient(supabaseUrl, anonKey);

  const { data, error } = await supabase.rpc("list_pos_venda_pendentes", { p_secret: secret });
  if (error) {
    console.error("[cron pos-venda] erro ao listar pendentes", error);
    return NextResponse.json({ ok: false });
  }

  const pendentes = (data ?? []) as {
    appointment_id: string;
    tenant_id: string;
    contact_id: string;
    contact_nome: string | null;
    contact_telefone: string;
    servico: string | null;
    mensagem_customizada: string | null;
    phone_number_id: string;
    access_token: string;
  }[];

  let enviados = 0;
  let forDaJanela = 0;
  let falhas = 0;
  let pausadosPorQualidade = 0;

  for (const p of pendentes) {
    // Mensagem iniciada pelo negócio (não é resposta a cliente) — respeita
    // a pausa de segurança se a qualidade do número caiu.
    if (!(await podeEnviarAutomatico(supabase, secret, { tenantId: p.tenant_id, telefone: p.contact_telefone }))) {
      pausadosPorQualidade++;
      continue;
    }

    const primeiroNome = p.contact_nome?.trim().split(/\s+/)[0] ?? "";
    const texto = (
      p.mensagem_customizada?.trim() ||
      "Oi {nome}! Passando aqui rapidinho: como foi seu {servico} com a gente? Adoraríamos saber 🙂"
    )
      .replace(/\{nome\}/g, primeiroNome)
      .replace(/\{servico\}/g, p.servico || "atendimento");

    try {
      await sendWhatsAppText(
        { phoneNumberId: p.phone_number_id, token: p.access_token },
        p.contact_telefone,
        texto,
      );
      await supabase.rpc("record_pos_venda_enviado", { p_secret: secret, p_appointment_id: p.appointment_id });
      enviados++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // A Meta só deixa mandar texto livre dentro de 24h da última
      // mensagem do cliente. Pra prazos de 1d/5d isso é esperado (cliente
      // não falou de novo desde o atendimento) — não é falha de conta, é
      // regra de negócio da própria Meta. Resolver de verdade exige um
      // template de mensagem aprovado por eles (passo manual, fora do
      // nosso controle). Por enquanto só desiste dessa mensagem específica,
      // sem acionar o alerta de "WhatsApp desconectado".
      const forDaJanelaDe24h = /24 hours|window|janela/i.test(msg);
      if (forDaJanelaDe24h) {
        forDaJanela++;
        await supabase.rpc("record_pos_venda_enviado", { p_secret: secret, p_appointment_id: p.appointment_id });
      } else {
        falhas++;
        console.error("[cron pos-venda] falha ao enviar", p.appointment_id, err);
        await supabase.rpc("record_whatsapp_send_failure", {
          p_secret: secret,
          p_tenant_id: p.tenant_id,
          p_erro: err instanceof Error ? err.message : "Falha ao enviar mensagem de pós-venda",
        });
      }
    }
  }

  // Reengajamento + recall por ciclo de serviço entram aqui também — o
  // Hobby da Vercel só libera 2 crons, os dois já usados (pós-venda e
  // lembretes), então isso não vira uma chamada de mensagem direta: só
  // cria a tarefa em outreach_tasks, pro time trabalhar por /tarefas.
  const { data: tarefasData, error: tarefasError } = await supabase.rpc(
    "gerar_tarefas_reengajamento_e_recall",
    { p_secret: secret },
  );
  if (tarefasError) {
    console.error("[cron pos-venda] erro ao gerar tarefas de reengajamento/recall", tarefasError);
  }
  const tarefas = (tarefasData ?? { reengajamento_criadas: 0, recall_criadas: 0 }) as {
    reengajamento_criadas: number;
    recall_criadas: number;
  };

  // Lista de espera: quem foi avisado de uma vaga e não confirmou em 6h
  // expira, e a vaga passa pro próximo da fila — mesma lógica de 2
  // crons/dia, então quem entra na lista de espera às vezes só vê a vaga
  // no dia seguinte (aceitável no plano Hobby; o primeiro aviso, esse sim,
  // já sai na hora, direto do cancelamento — ver ai.ts).
  const { data: listaEsperaData, error: listaEsperaError } = await supabase.rpc(
    "ia_expirar_avisados_lista_espera",
    { p_secret: secret },
  );
  if (listaEsperaError) {
    console.error("[cron pos-venda] erro ao expirar lista de espera", listaEsperaError);
  }
  const listaEspera = (listaEsperaData ?? { expirados: 0, avisar: [] }) as {
    expirados: number;
    avisar: {
      waitlist_id: string;
      contact_nome: string | null;
      contact_telefone: string;
      preferencia_horario: string | null;
      phone_number_id: string;
      access_token: string;
    }[];
  };

  let listaEsperaAvisados = 0;
  let listaEsperaPausados = 0;
  for (const item of listaEspera.avisar) {
    if (
      !(await podeEnviarAutomatico(supabase, secret, {
        phoneNumberId: item.phone_number_id,
        telefone: item.contact_telefone,
      }))
    ) {
      listaEsperaPausados++;
      continue;
    }

    const primeiroNome = item.contact_nome?.trim().split(/\s+/)[0] ?? "";
    const texto = `Oi${primeiroNome ? " " + primeiroNome : ""}! Abriu uma vaga${
      item.preferencia_horario ? ` (${item.preferencia_horario})` : ""
    } — quer confirmar? Responde aqui que eu já deixo marcado.`;
    try {
      await sendWhatsAppText(
        { phoneNumberId: item.phone_number_id, token: item.access_token },
        item.contact_telefone,
        texto,
      );
      listaEsperaAvisados++;
    } catch (err) {
      console.error("[cron pos-venda] falha ao avisar próximo da lista de espera", item.waitlist_id, err);
    }
  }

  // Recuperação de conversa esfriada: 1º/2º toque de quem recebeu uma
  // proposta de horário e nunca confirmou, e fecha (outreach_task) quem
  // não respondeu aos dois toques.
  const { data: recuperacaoData, error: recuperacaoError } = await supabase.rpc(
    "ia_recuperar_conversas_esfriadas",
    { p_secret: secret },
  );
  if (recuperacaoError) {
    console.error("[cron pos-venda] erro ao recuperar conversas esfriadas", recuperacaoError);
  }
  const recuperacao = (recuperacaoData ?? { esfriadas: 0, avisar: [] }) as {
    esfriadas: number;
    avisar: {
      contact_telefone: string;
      texto: string;
      phone_number_id: string;
      access_token: string;
    }[];
  };

  let recuperacaoTocada = 0;
  let recuperacaoPausada = 0;
  for (const item of recuperacao.avisar) {
    if (
      !(await podeEnviarAutomatico(supabase, secret, {
        phoneNumberId: item.phone_number_id,
        telefone: item.contact_telefone,
      }))
    ) {
      recuperacaoPausada++;
      continue;
    }

    try {
      await sendWhatsAppText(
        { phoneNumberId: item.phone_number_id, token: item.access_token },
        item.contact_telefone,
        item.texto,
      );
      recuperacaoTocada++;
    } catch (err) {
      console.error("[cron pos-venda] falha ao mandar toque de recuperação", err);
    }
  }

  // Resumo de conversas por IA: roda por último, pra não atrasar os
  // envios de WhatsApp acima se a API do Claude estiver lenta.
  const resumos = await processarResumosPendentes(supabase, secret);

  // Resumo do histórico antigo de WhatsApp (Coexistência) — mesma lógica,
  // também por último e em lote pequeno.
  const resumosHistorico = await processarResumosHistoricoPendentes(supabase, secret);

  return NextResponse.json({
    ok: true,
    total: pendentes.length,
    enviados,
    forDaJanela,
    falhas,
    pausadosPorQualidade,
    reengajamentoCriadas: tarefas.reengajamento_criadas,
    recallCriadas: tarefas.recall_criadas,
    listaEsperaExpirados: listaEspera.expirados,
    listaEsperaAvisados,
    listaEsperaPausados,
    recuperacaoEsfriadas: recuperacao.esfriadas,
    recuperacaoTocada,
    recuperacaoPausada,
    resumosGerados: resumos.resumidas,
    resumosFalhas: resumos.falhas,
    historicoResumido: resumosHistorico.resumidos,
    historicoFalhas: resumosHistorico.falhas,
  });
}

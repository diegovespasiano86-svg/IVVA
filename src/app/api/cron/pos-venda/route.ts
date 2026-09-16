import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/whatsapp";

// Roda 1x por dia (limite do plano Hobby da Vercel — ver vercel.json).
// Isso significa que os prazos "1h"/"2h" na prática viram "dentro do
// mesmo dia" em vez de exatos; "1d"/"5d" continuam precisos. Precisa de
// plano Pro pra rodar de hora em hora de verdade.
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

  for (const p of pendentes) {
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

  return NextResponse.json({
    ok: true,
    total: pendentes.length,
    enviados,
    forDaJanela,
    falhas,
    reengajamentoCriadas: tarefas.reengajamento_criadas,
    recallCriadas: tarefas.recall_criadas,
  });
}

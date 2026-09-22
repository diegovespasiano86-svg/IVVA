import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppInteractiveButtons } from "@/lib/whatsapp";
import { podeEnviarAutomatico } from "@/lib/automacao";

// Roda 1x por dia (2º e último cron disponível no plano Hobby da Vercel).
// Por isso a janela é generosa (20h-32h antes do horário) em vez de um
// "24h antes" exato — é a melhor precisão possível sem plano Pro.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) {
    console.error("[cron lembretes] WHATSAPP_WEBHOOK_INTERNAL_SECRET não configurado");
    return NextResponse.json({ ok: false });
  }

  const supabase = createClient(supabaseUrl, anonKey);

  const { data, error } = await supabase.rpc("list_lembrete_pendentes", { p_secret: secret });
  if (error) {
    console.error("[cron lembretes] erro ao listar pendentes", error);
    return NextResponse.json({ ok: false });
  }

  const pendentes = (data ?? []) as {
    appointment_id: string;
    tenant_id: string;
    contact_telefone: string;
    contact_nome: string | null;
    servico: string | null;
    data_hora: string;
    professional_nome: string | null;
    phone_number_id: string;
    access_token: string;
  }[];

  let enviados = 0;
  let falhas = 0;
  let pausadosPorQualidade = 0;

  for (const p of pendentes) {
    if (!(await podeEnviarAutomatico(supabase, secret, { tenantId: p.tenant_id, telefone: p.contact_telefone }))) {
      pausadosPorQualidade++;
      continue;
    }

    const dataFmt = new Date(p.data_hora).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const primeiroNome = p.contact_nome?.trim().split(/\s+/)[0] ?? "";
    const texto =
      `Oi${primeiroNome ? " " + primeiroNome : ""}! Passando pra lembrar do seu ${p.servico || "horário"}` +
      `${p.professional_nome ? ` com ${p.professional_nome}` : ""}, ${dataFmt}. Confirma pra gente?`;

    try {
      await sendWhatsAppInteractiveButtons(
        { phoneNumberId: p.phone_number_id, token: p.access_token },
        p.contact_telefone,
        texto,
        [
          { id: `confirmar:${p.appointment_id}`, title: "Confirmar" },
          { id: `remarcar:${p.appointment_id}`, title: "Preciso remarcar" },
        ],
      );
      await supabase.rpc("record_lembrete_enviado", { p_secret: secret, p_appointment_id: p.appointment_id });
      enviados++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // Mesma regra da Meta do pós-venda: mensagem iniciada pelo negócio
      // (não é resposta a algo que o cliente mandou) só funciona dentro de
      // 24h da última mensagem dele. Como o lembrete é mandado ~1 dia
      // antes do horário, isso vai acontecer com frequência — só resolve
      // de vez com um template de mensagem aprovado pela Meta.
      if (/24 hours|window|janela/i.test(msg)) {
        await supabase.rpc("record_lembrete_enviado", { p_secret: secret, p_appointment_id: p.appointment_id });
      } else {
        falhas++;
        console.error("[cron lembretes] falha ao enviar", p.appointment_id, err);
        await supabase.rpc("record_whatsapp_send_failure", {
          p_secret: secret,
          p_tenant_id: p.tenant_id,
          p_erro: err instanceof Error ? err.message : "Falha ao enviar lembrete de confirmação",
        });
      }
    }
  }

  return NextResponse.json({ ok: true, total: pendentes.length, enviados, falhas, pausadosPorQualidade });
}

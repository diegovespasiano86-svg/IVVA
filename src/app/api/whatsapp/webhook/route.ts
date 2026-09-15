import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Verificação inicial do webhook — a Meta chama essa rota com um GET pra
// confirmar que o endpoint é nosso antes de ativar o recebimento de eventos.
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// Formato do payload de mensagem recebida da Meta:
// entry[].changes[].value.{metadata.phone_number_id, contacts[], messages[]}
type WhatsAppWebhookBody = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: { from?: string; text?: { body?: string }; type?: string }[];
      };
    }[];
  }[];
};

// Recebe eventos reais: mensagens de clientes e status de entrega das
// mensagens que a gente manda (accepted/delivered/read/failed). Roteia
// pro tenant certo via a função ingest_whatsapp_message (SECURITY DEFINER
// no banco — não precisamos da service role key aqui, só a chave anon).
export async function POST(request: NextRequest) {
  const body: WhatsAppWebhookBody = await request.json();
  console.log("[whatsapp webhook]", JSON.stringify(body));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      for (const msg of value?.messages ?? []) {
        if (msg.type !== "text" || !msg.from) continue;
        const contactName = value?.contacts?.find(
          (c) => c.wa_id === msg.from,
        )?.profile?.name;

        await supabase.rpc("ingest_whatsapp_message", {
          p_phone_number_id: phoneNumberId,
          p_wa_id: msg.from,
          p_contact_name: contactName ?? null,
          p_content: msg.text?.body ?? "",
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}

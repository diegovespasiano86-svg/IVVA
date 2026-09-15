import { type NextRequest, NextResponse } from "next/server";

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

// Recebe eventos reais: mensagens de clientes e status de entrega das
// mensagens que a gente manda (accepted/delivered/read/failed).
// Por enquanto só loga — a gravação real em conversations/messages entra
// na próxima etapa, junto com o roteamento por tenant.
export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log("[whatsapp webhook]", JSON.stringify(body));
  return NextResponse.json({ received: true });
}

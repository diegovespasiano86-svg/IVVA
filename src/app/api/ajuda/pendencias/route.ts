import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { carregarPendencias } from "@/lib/pendencias";

// Pendências do cadastro para o círculo piscando da Ivva (botão do topo). Só lê; não altera nada.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ total: 0, essenciais: 0, urgente: false, itens: [] }, { status: 401 });
  const pend = await carregarPendencias(supabase);
  return NextResponse.json(pend, { headers: { "cache-control": "no-store" } });
}

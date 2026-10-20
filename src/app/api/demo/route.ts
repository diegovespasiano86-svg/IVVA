import { NextResponse } from "next/server";
import { lerTextoDoSite } from "@/lib/ler-site";
import { extrairEntradasConhecimento } from "@/lib/extracao-conhecimento";
import { liberarUso } from "@/lib/demo-viva";

// Passo 1 da demonstração viva: lê o site informado e devolve os fatos que o robô aprendeu.
// Não grava nada. Público, com limite por visitante.
export async function POST(req: Request) {
  let endereco = "";
  try {
    endereco = String((await req.json()).endereco ?? "");
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (!endereco.trim()) return NextResponse.json({ erro: "Digite o endereço do seu site." }, { status: 400 });

  if (!(await liberarUso(req))) {
    return NextResponse.json({ erro: "A demonstração está com muito uso agora. Tente de novo mais tarde ou assine com 14 dias grátis." }, { status: 429 });
  }

  try {
    const { texto } = await lerTextoDoSite(endereco);
    const { entradas } = await extrairEntradasConhecimento({ texto });
    if (entradas.length === 0) {
      return NextResponse.json({ erro: "Li a página, mas não achei preços, horários ou serviços. Tente a página de serviços ou de contato." }, { status: 422 });
    }
    return NextResponse.json({ fatos: entradas.slice(0, 25) });
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    const amigavel = /endereço|site|página|http|redirecion/i.test(m);
    if (!amigavel) console.error("[demo] falha", e);
    return NextResponse.json({ erro: amigavel ? m : "Não consegui ler o site agora. Tente de novo em instantes." }, { status: amigavel ? 422 : 502 });
  }
}

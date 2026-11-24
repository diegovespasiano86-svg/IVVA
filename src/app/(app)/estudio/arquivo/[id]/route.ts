import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Abre um arquivo do Estúdio com link temporário. A permissão vem do banco: o cliente só vê os do próprio negócio. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: arq } = await supabase.from("estudio_arquivos").select("path, pasta, pedido_id, nome").eq("id", id).maybeSingle();
  if (!arq) return NextResponse.redirect(new URL("/estudio/relatorios", req.url));
  const { data, error } = await supabase.storage.from("estudio").createSignedUrl(arq.path, 300, { download: arq.pasta !== "relatorio" ? arq.nome : undefined });
  if (error || !data) return NextResponse.redirect(new URL("/estudio/relatorios", req.url));
  if (arq.pasta === "relatorio" && arq.pedido_id) await supabase.rpc("estudio_marcar_aberto", { p_pedido: arq.pedido_id });
  return NextResponse.redirect(data.signedUrl);
}

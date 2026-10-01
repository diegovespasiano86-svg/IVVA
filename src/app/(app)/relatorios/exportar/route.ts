import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerPeriodo, montarCsv, montarXlsx } from "@/lib/relatorios";
import { TIPOS_DATASET, carregarDataset, type TipoDataset } from "@/lib/relatorios-dados";

// Download dos relatórios em CSV ou Excel. Só o dono do negócio exporta.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tipo = url.searchParams.get("tipo") as TipoDataset | null;
  const formato = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  if (!tipo || !TIPOS_DATASET.includes(tipo)) return new NextResponse("Relatório inválido.", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Entre na sua conta para exportar.", { status: 401 });

  const { data: perfil } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (perfil?.role !== "dono") return new NextResponse("Só o dono do negócio pode exportar dados.", { status: 403 });

  const periodo = lerPeriodo(url.searchParams.get("periodo") ?? undefined);
  const ds = await carregarDataset(supabase, tipo, periodo);

  if (formato === "xlsx") {
    const buf = await montarXlsx(ds.titulo, ds.colunas, ds.linhas);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${ds.arquivo}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(montarCsv(ds.colunas, ds.linhas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ds.arquivo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

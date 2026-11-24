"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gerarESalvarRelatorio } from "@/lib/diagnostico-servidor";

// Ações do painel de implantação. Todas as funções do banco conferem is_platform_admin.

function atualizar(tenant: string) {
  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${tenant}`);
}

export async function anotarCliente(formData: FormData) {
  const tenant = String(formData.get("tenant") ?? "");
  const tipo = String(formData.get("tipo") ?? "nota") === "reuniao" ? "reuniao" : "nota";
  const texto = String(formData.get("texto") ?? "").trim();
  if (!tenant || !texto) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cliente_anotar", { p_tenant: tenant, p_tipo: tipo, p_texto: texto });
  if (error) console.error("[implantacao] anotar", error.message);
  atualizar(tenant);
}

export async function marcarReuniao(formData: FormData) {
  const tenant = String(formData.get("tenant") ?? "");
  const quando = String(formData.get("quando") ?? "").trim();
  if (!tenant) return;
  // O campo vem no horário de Brasília (datetime-local, sem fuso).
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(quando) ? new Date(`${quando}:00-03:00`).toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cliente_reuniao", { p_tenant: tenant, p_quando: iso });
  if (error) console.error("[implantacao] reuniao", error.message);
  atualizar(tenant);
}

export async function marcarImplantado(formData: FormData) {
  const tenant = String(formData.get("tenant") ?? "");
  const feito = String(formData.get("feito") ?? "") === "1";
  if (!tenant) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cliente_implantado", { p_tenant: tenant, p_feito: feito });
  if (error) console.error("[implantacao] implantado", error.message);
  atualizar(tenant);
}

export async function refazerRelatorio(formData: FormData) {
  const tenant = String(formData.get("tenant") ?? "");
  if (!tenant) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_exigir");
  if (error) return;
  await gerarESalvarRelatorio(tenant);
  atualizar(tenant);
}

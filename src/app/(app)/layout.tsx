import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import { navForRole, type Role } from "@/lib/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("users")
    .select("nome, role, tenant_id, tenants(nome)")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="max-w-[420px]">
          <h1 className="font-display text-[19px] font-bold">
            Seu acesso ainda não foi configurado
          </h1>
          <p className="mt-2 text-[13.5px] text-ink-soft">
            Sua conta existe, mas ainda não está vinculada a nenhum negócio
            na ivva. Fale com quem está implantando o sistema para liberar
            seu acesso.
          </p>
        </div>
      </main>
    );
  }

  const role = perfil.role as Role;
  const tenantNome =
    (perfil.tenants as unknown as { nome: string } | null)?.nome ?? "ivva";
  const items = navForRole(role);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        items={items}
        negocio={tenantNome}
        nome={perfil.nome}
        role={role}
      />
      <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}

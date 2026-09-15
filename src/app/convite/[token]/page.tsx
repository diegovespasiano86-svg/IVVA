import { createClient } from "@/lib/supabase/server";
import AcceptForm from "./accept-form";

export default async function ConvitePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  const supabase = await createClient();
  const { data: rpcData, error } = await supabase
    .rpc("get_invite_public", { p_token: token })
    .maybeSingle();

  const data = rpcData as {
    nome: string;
    email: string;
    tenant_nome: string;
    valido: boolean;
  } | null;

  if (error || !data || !data.valido) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="font-display text-[19px] font-bold">
            Convite inválido ou expirado
          </h1>
          <p className="mt-2 text-[13.5px] text-ink-soft">
            Peça pra quem te convidou gerar um novo link em{" "}
            <span className="font-semibold">Conta e assinatura</span>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_1px_2px_rgba(36,31,46,0.04)]">
          <h1 className="font-display text-[20px] font-bold">
            Você foi convidado(a) 👋
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {data.nome}, você foi chamado(a) pra fazer parte da equipe de{" "}
            <span className="font-semibold text-ink">{data.tenant_nome}</span>{" "}
            na ivva. Só falta criar sua senha.
          </p>
          <p className="mt-3 text-[12px] text-ink-faint">
            E-mail: <span className="font-semibold">{data.email}</span>
          </p>
          <AcceptForm token={token} />
        </div>
      </div>
    </main>
  );
}

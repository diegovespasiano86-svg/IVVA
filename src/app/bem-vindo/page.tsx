import { getCheckoutSession } from "@/lib/stripe";
import SetupForm from "./setup-form";

export default async function BemVindoPage(props: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await props.searchParams;

  if (!sessionId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="font-display text-[19px] font-bold">
            Link inválido
          </h1>
          <p className="mt-2 text-[13.5px] text-ink-soft">
            Volte pra{" "}
            <a href="/planos" className="font-semibold text-ink">
              página de planos
            </a>{" "}
            e assine de novo.
          </p>
        </div>
      </main>
    );
  }

  let nomeNegocio = "seu negócio";
  try {
    const session = await getCheckoutSession(sessionId);
    nomeNegocio = session.metadata?.nome_negocio ?? nomeNegocio;
  } catch {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="font-display text-[19px] font-bold">
            Não encontramos esse pagamento
          </h1>
          <p className="mt-2 text-[13.5px] text-ink-soft">
            Volte pra{" "}
            <a href="/planos" className="font-semibold text-ink">
              página de planos
            </a>{" "}
            e tente de novo.
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
            Pagamento confirmado 🎉
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Falta pouco pra {nomeNegocio} começar a usar a ivva — só criar
            seu acesso.
          </p>
          <SetupForm sessionId={sessionId} />
        </div>
      </div>
    </main>
  );
}

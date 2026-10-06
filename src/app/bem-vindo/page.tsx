import { getCheckoutSession } from "@/lib/stripe";
import SetupForm from "./setup-form";

const CARTAO = "rounded-3xl bg-white p-7 text-[#0e0e13] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]";

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className={`${CARTAO} text-center`}>
      <h1 className="text-[20px] font-extrabold">{titulo}</h1>
      <p className="mt-2 text-[13.5px] text-[#6b6577]">{children}</p>
    </div>
  );
}

const LinkPlanos = (
  <a href="/planos" className="font-semibold text-[#6d5be0] underline">
    página de planos
  </a>
);

export default async function BemVindoPage(props: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await props.searchParams;

  if (!sessionId) {
    return <Aviso titulo="Link inválido">Volte pra {LinkPlanos} e assine de novo.</Aviso>;
  }

  let nomeNegocio = "seu negócio";
  let nomeInicial = "";
  let segmentoInicial: string | null = null;
  try {
    const session = await getCheckoutSession(sessionId);
    nomeNegocio = session.metadata?.nome_negocio ?? nomeNegocio;
    nomeInicial = session.metadata?.nome ?? "";
    segmentoInicial = session.metadata?.segmento ?? null;
  } catch {
    return <Aviso titulo="Não encontramos esse pagamento">Volte pra {LinkPlanos} e tente de novo.</Aviso>;
  }

  return (
    <div className={CARTAO}>
      <h1 className="text-[20px] font-extrabold">Pagamento confirmado 🎉</h1>
      <p className="mt-1 text-[13.5px] text-[#6b6577]">
        Falta pouco pra {nomeNegocio} começar a usar a ivva — só criar seu acesso.
      </p>
      <SetupForm sessionId={sessionId} nomeInicial={nomeInicial} segmentoInicial={segmentoInicial} />
    </div>
  );
}

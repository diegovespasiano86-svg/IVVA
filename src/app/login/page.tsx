import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; conta_apagada?: string }>;
}) {
  const { erro, conta_apagada: contaApagada } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 34 34">
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2FBF9F" />
                <stop offset="0.55" stopColor="#8B7FE8" />
                <stop offset="1" stopColor="#FF6B5B" />
              </linearGradient>
            </defs>
            <rect width="34" height="34" rx="10" fill="url(#lg)" />
            <path
              d="M7 20c2 0 2.5-8 5-8s2 10 4.5 10 2.5-12 5-12 2 10 4.5 10"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-display text-[22px] font-extrabold lowercase tracking-tight">
            ivva
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-8 shadow-[0_1px_2px_rgba(36,31,46,0.04)]">
          <h1 className="font-display text-[20px] font-bold">Entrar</h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Acesso de dono do negócio ou de profissional — cada um vê o que
            precisa.
          </p>
          {erro === "link_invalido" && (
            <p className="mt-4 rounded-[10px] border border-coral/30 bg-coral/5 px-3.5 py-2.5 text-[12.5px] font-semibold text-coral">
              Esse link expirou ou já foi usado. Peça a recuperação de senha de novo.
            </p>
          )}
          {contaApagada === "1" && (
            <p className="mt-4 rounded-[10px] border border-teal/30 bg-teal/5 px-3.5 py-2.5 text-[12.5px] font-semibold text-teal">
              Sua conta e todos os dados foram apagados com sucesso.
            </p>
          )}
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-[12.5px] text-ink-faint">
          Ainda não tem acesso? Fale com quem está implantando a ivva no seu
          negócio.
        </p>
      </div>
    </main>
  );
}

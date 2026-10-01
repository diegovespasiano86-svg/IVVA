import { CircleAlert, CircleCheck } from "lucide-react";
import AuthLayout from "@/components/auth-layout";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; conta_apagada?: string }>;
}) {
  const { erro, conta_apagada: contaApagada } = await searchParams;

  return (
    <AuthLayout footer="Ainda não tem acesso? Fale com quem está implantando a ivva no seu negócio.">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">Bem-vindo de volta</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-soft">Entre como dono do negócio ou profissional. Cada um vê o que precisa.</p>

      {erro === "link_invalido" && (
        <p className="mt-5 flex items-start gap-2 rounded-xl border border-coral/25 bg-[#fdece9] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#8f2a1c]">
          <CircleAlert size={16} className="mt-px shrink-0" /> Esse link expirou ou já foi usado. Peça a recuperação de senha de novo.
        </p>
      )}
      {contaApagada === "1" && (
        <p className="mt-5 flex items-start gap-2 rounded-xl border border-teal/25 bg-[#e3f4ef] px-3.5 py-2.5 text-[12.5px] font-semibold text-teal">
          <CircleCheck size={16} className="mt-px shrink-0" /> Sua conta e todos os dados foram apagados com sucesso.
        </p>
      )}

      <LoginForm />
    </AuthLayout>
  );
}

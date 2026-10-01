import Link from "next/link";
import AuthLayout from "@/components/auth-layout";
import EsqueciSenhaForm from "./esqueci-senha-form";

export default function EsqueciSenhaPage() {
  return (
    <AuthLayout
      footer={
        <Link href="/login" className="font-bold text-purple hover:underline">
          Voltar pro login
        </Link>
      }
    >
      <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">Esqueceu sua senha?</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-soft">Digite o e-mail da sua conta que a gente manda um link pra criar uma senha nova.</p>
      <EsqueciSenhaForm />
    </AuthLayout>
  );
}

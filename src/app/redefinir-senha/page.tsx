import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AuthLayout from "@/components/auth-layout";
import RedefinirSenhaForm from "./redefinir-senha-form";

export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthLayout>
      {user ? (
        <>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">Criar senha nova</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-soft">Escolhe uma senha nova pra sua conta na ivva.</p>
          <RedefinirSenhaForm />
        </>
      ) : (
        <>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">Link expirado ou inválido</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-soft">
            Esse link de recuperação não é mais válido: pode já ter sido usado ou ter expirado. Pede um novo abaixo.
          </p>
          <Link href="/esqueci-senha" className="btn btn-primary btn-lg mt-6 w-full">
            Pedir novo link <ArrowRight size={17} className="btn-arrow" />
          </Link>
        </>
      )}
    </AuthLayout>
  );
}

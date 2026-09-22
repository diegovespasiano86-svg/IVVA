import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RedefinirSenhaForm from "./redefinir-senha-form";

export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
          {user ? (
            <>
              <h1 className="font-display text-[20px] font-bold">Criar senha nova</h1>
              <p className="mt-1 text-[13.5px] text-ink-soft">
                Escolhe uma senha nova pra sua conta na ivva.
              </p>
              <RedefinirSenhaForm />
            </>
          ) : (
            <>
              <h1 className="font-display text-[20px] font-bold">Link expirado ou inválido</h1>
              <p className="mt-1 text-[13.5px] text-ink-soft">
                Esse link de recuperação não é mais válido — pode já ter sido
                usado ou ter expirado. Pede um novo abaixo.
              </p>
              <Link
                href="/esqueci-senha"
                className="btn mt-4 w-full justify-center bg-ink py-3 text-[14px] text-white"
              >
                Pedir novo link
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

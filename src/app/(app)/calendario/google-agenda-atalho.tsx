import Link from "next/link";
import { CalendarSync, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { googleConfigurado } from "@/lib/google-agenda";

/** Atalho no calendário: liga (ou mostra que já está ligada) a agenda do Google para ver os horários no celular. */
export default async function GoogleAgendaAtalho() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: conexao } = user
    ? await supabase.from("google_agenda_conexoes").select("email, ativo").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const conectado = Boolean(conexao?.ativo);
  const disponivel = googleConfigurado();

  return (
    <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[13.5px] font-extrabold">
          Ver no celular · Google Agenda{" "}
          {conectado && (
            <span className="ml-1 inline-flex items-center gap-1 text-[12px] font-bold text-teal">
              <Check size={13} aria-hidden /> Conectado
            </span>
          )}
        </p>
        <p className="text-[12.5px] text-ink-soft">
          {conectado
            ? `Os agendamentos aparecem na agenda ${conexao?.email ? `de ${conexao.email}` : "do Google"}, no app do seu celular.`
            : "Conecte uma vez e cada agendamento (do robô ou da equipe) cai sozinho na agenda do seu celular."}
        </p>
      </div>
      {conectado ? (
        <Link href="/integracoes" className="btn btn-secondary btn-md">
          Gerenciar
        </Link>
      ) : disponivel ? (
        <a href="/api/google-agenda/conectar" className="btn btn-primary btn-md">
          <CalendarSync size={16} aria-hidden /> Conectar Google Agenda
        </a>
      ) : (
        <span className="text-[12.5px] font-semibold text-ink-faint">Em breve nesta conta.</span>
      )}
    </div>
  );
}

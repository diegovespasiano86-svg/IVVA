import { createClient } from "@/lib/supabase/server";
import { googleConfigurado } from "@/lib/google-agenda";
import { alternarConvidarCliente, desconectarGoogleAgenda, sincronizarAgoraGoogle } from "./google-actions";

const AVISO: Record<string, { ok: boolean; texto: string }> = {
  ok: { ok: true, texto: "Google Agenda conectado! Seus próximos agendamentos já foram enviados." },
  negado: { ok: false, texto: "A permissão não foi concedida. Tente de novo e marque a opção de acesso à agenda." },
  erro: { ok: false, texto: "Não consegui conectar o Google Agenda. Tente de novo; se repetir, fale com o suporte." },
  indisponivel: { ok: false, texto: "A ligação com o Google Agenda ainda não está liberada nesta conta." },
  nada: { ok: true, texto: "Tudo em dia: não há agendamentos novos para enviar ao Google." },
  erro_sync: { ok: false, texto: "Não consegui enviar para o Google. O motivo aparece logo abaixo." },
};

/** Liga a agenda do Google de quem está logado: o que o robô (ou a equipe) agendar na ivva aparece lá sozinho. */
export default async function GoogleAgendaCard({ aviso }: { aviso?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: conexao } = user
    ? await supabase.from("google_agenda_conexoes").select("email, convidar_cliente, ativo, erro").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const disponivel = googleConfigurado();
  const enviados = aviso?.startsWith("ok") && aviso.length > 2 ? Number(aviso.slice(2)) : 0;
  const msg = enviados
    ? { ok: true, texto: `Pronto: ${enviados} ${enviados === 1 ? "agendamento enviado" : "agendamentos enviados"} para o Google Agenda.` }
    : aviso
      ? AVISO[aviso]
      : null;

  return (
    <div className="card mb-4 px-5 py-4">
      <p className="text-[14px] font-bold">
        Google Agenda <span className="font-normal text-ink-soft">· seus agendamentos na agenda do celular</span>{" "}
        {conexao?.ativo && <b className="ml-1 text-[12px] text-teal">Conectado</b>}
      </p>
      {msg && (
        <p role="status" className={`mt-2 rounded-[12px] px-4 py-3 text-[13px] font-semibold ${msg.ok ? "bg-teal/10 text-teal" : "bg-coral/10 text-coral"}`}>
          {msg.texto}
        </p>
      )}
      <p className="mb-3 mt-1 text-[12.5px] text-ink-soft">
        Tudo que o robô agendar (ou a equipe marcar na ivva) vira um evento na sua agenda do Google. Remarcou ou cancelou, a agenda acompanha.
      </p>

      {conexao?.ativo ? (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-soft">
            Conta ligada: <b>{conexao.email ?? "Google"}</b>
          </p>
          {conexao.erro && <p className="rounded-[10px] bg-coral/10 px-3 py-2 text-[12.5px] font-semibold text-coral">{conexao.erro}</p>}
          <form action={alternarConvidarCliente} className="flex items-start gap-2 text-[12.5px]">
            <input type="hidden" name="ligar" value={conexao.convidar_cliente ? "0" : "1"} />
            <button type="submit" className="btn btn-secondary btn-sm shrink-0">
              {conexao.convidar_cliente ? "Desligar" : "Ligar"}
            </button>
            <span className="text-ink-soft">
              <b>Enviar o convite ao cliente.</b> Quando o cliente tiver e-mail cadastrado, o Google manda o convite e o evento cai na agenda dele também.{" "}
              {conexao.convidar_cliente ? "Está ligado." : "Está desligado."}
            </span>
          </form>
          <div className="flex flex-wrap gap-2">
            <form action={sincronizarAgoraGoogle}>
              <button type="submit" className="btn btn-secondary btn-md">Sincronizar agora</button>
            </form>
            <form action={desconectarGoogleAgenda}>
              <button type="submit" className="btn btn-ghost btn-md">Desconectar</button>
            </form>
          </div>
        </div>
      ) : disponivel ? (
        <a href="/api/google-agenda/conectar" className="btn btn-primary btn-md w-fit">
          Conectar Google Agenda
        </a>
      ) : (
        <p className="text-[12.5px] font-semibold text-ink-faint">Em breve nesta conta.</p>
      )}
    </div>
  );
}

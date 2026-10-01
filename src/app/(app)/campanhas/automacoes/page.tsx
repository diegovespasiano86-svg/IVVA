import Link from "next/link";
import { ArrowLeft, Bell, Cake, Clock, HeartHandshake, MessageCircleHeart, Mic, RefreshCw, Star, Users, Zap, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import EmptyState from "@/components/empty-state";

type Cfg = {
  pos_venda_ativo?: boolean;
  reengajamento_ativo?: boolean;
  reengajamento_dias_inatividade?: number | null;
  aniversario_ativo?: boolean;
  lista_espera_ativo?: boolean;
  recuperar_conversa_ativo?: boolean;
  indicacao_recompensa_ativo?: boolean;
  responder_audio_ativo?: boolean;
  link_avaliacao_google?: string | null;
};

type Automacao = { titulo: string; texto: string; icon: LucideIcon; ativa: boolean; detalhe?: string; fixa?: boolean };

export default async function AutomacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("users").select("role").eq("id", user?.id ?? "").maybeSingle();

  if (perfil?.role !== "dono") {
    return (
      <div>
        <PageHeader icon={Zap} title="Automações" />
        <div className="card">
          <EmptyState icon={Zap} title="Só o dono do negócio vê as automações" />
        </div>
      </div>
    );
  }

  const { data } = await supabase.from("bot_settings").select("*").maybeSingle();
  const c = (data ?? {}) as Cfg;

  const lista: Automacao[] = [
    { titulo: "Lembrete de horário", texto: "Avisa o cliente antes do atendimento e pede confirmação com um toque.", icon: Bell, ativa: true, fixa: true, detalhe: "Sempre ligado" },
    { titulo: "Pós-venda", texto: "Pergunta como foi o atendimento depois que ele termina.", icon: HeartHandshake, ativa: !!c.pos_venda_ativo },
    {
      titulo: "Sentimos sua falta",
      texto: "Cria tarefas para a equipe chamar clientes que sumiram.",
      icon: Users,
      ativa: !!c.reengajamento_ativo,
      detalhe: c.reengajamento_ativo && c.reengajamento_dias_inatividade ? `Após ${c.reengajamento_dias_inatividade} dias sem voltar` : undefined,
    },
    { titulo: "Aniversário", texto: "Lembra a equipe de parabenizar quem faz aniversário.", icon: Cake, ativa: !!c.aniversario_ativo },
    { titulo: "Lista de espera", texto: "Avisa o próximo da fila quando surge uma vaga.", icon: Clock, ativa: !!c.lista_espera_ativo },
    { titulo: "Recuperar conversa esfriada", texto: "Retoma a conversa de quem pediu horário e não confirmou.", icon: RefreshCw, ativa: !!c.recuperar_conversa_ativo },
    { titulo: "Pedido de avaliação no Google", texto: "Convida clientes satisfeitos a avaliar o negócio.", icon: Star, ativa: !!c.link_avaliacao_google, detalhe: c.link_avaliacao_google ? "Link configurado" : "Falta informar o link" },
    { titulo: "Indicação com recompensa", texto: "Estimula clientes a indicarem amigos.", icon: MessageCircleHeart, ativa: !!c.indicacao_recompensa_ativo },
    { titulo: "Resposta por áudio", texto: "O robô responde em áudio quando o cliente manda áudio.", icon: Mic, ativa: !!c.responder_audio_ativo },
  ];

  return (
    <div>
      <Link href="/campanhas" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={15} /> Campanhas
      </Link>
      <PageHeader
        icon={Zap}
        title="Automações"
        subtitle="Mensagens e tarefas que o robô faz sozinho, sem você precisar lembrar."
        actions={
          <Link href="/robo" className="btn btn-primary btn-md">
            Configurar no robô
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((a) => {
          const Icon = a.icon;
          return (
            <section key={a.titulo} className="card card-lift flex flex-col px-5 py-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.ativa ? "bg-[#e3f4ef] text-teal" : "bg-surface-soft text-ink-faint"}`}>
                  <Icon size={19} />
                </span>
                <span className={`badge ${a.ativa ? "badge-success" : "badge-neutral"}`}>{a.fixa ? "Sempre ligada" : a.ativa ? "Ligada" : "Desligada"}</span>
              </div>
              <h2 className="text-[14.5px] font-extrabold">{a.titulo}</h2>
              <p className="mt-1 flex-1 text-[12.5px] leading-snug text-ink-soft">{a.texto}</p>
              {a.detalhe && <p className="mt-2 text-[11.5px] font-semibold text-purple">{a.detalhe}</p>}
            </section>
          );
        })}
      </div>
      <p className="mt-5 text-[12.5px] text-ink-soft">
        Para ligar, desligar ou ajustar cada uma, vá em{" "}
        <Link href="/robo" className="font-bold text-purple hover:underline">
          Robô (IA) &gt; Personalidade e regras
        </Link>
        .
      </p>
    </div>
  );
}

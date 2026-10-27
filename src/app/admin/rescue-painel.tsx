import type { SupabaseClient } from "@supabase/supabase-js";
import { brl, estimativaGanho, linkWhatsapp, mensagemWhatsappOnboarding } from "@/lib/rescue";
import { nomePlano } from "@/lib/planos";

type Linha = {
  tenant_id: string;
  negocio: string;
  segmento: string | null;
  plano: string | null;
  plano_bonus: string | null;
  plano_bonus_ate: string | null;
  dono_nome: string | null;
  dono_email: string | null;
  telefone: string | null;
  dias: number;
  whatsapp: boolean;
  conhecimento: number;
  profissionais: number;
  robo: boolean;
  agendamentos: number;
  conversas_7d: number;
  ultimo_contato: string | null;
  contatos: number;
  presente: string | null;
};

type Evento = { tipo: string; etapa: number; canal: string; email: string | null; created_at: string; detalhe: Record<string, unknown> };

const ROTULO_EVENTO: Record<string, string> = {
  onboarding_parado: "Contato: preenchimento parado",
  cadastro_abandonado: "Contato: cadastro abandonado",
  bonus_aplicado: "Presente: plano acima ligado",
  bonus_encerrado: "Presente: plano voltou ao contratado",
  presente: "Presente escolhido no site",
};

/** Saúde de cada negócio: vermelho = não começou; amarelo = começou e ainda não atende; verde = atendendo. */
function saude(l: Linha): { cor: "vermelho" | "amarelo" | "verde"; texto: string } {
  const passos = Number(l.whatsapp) + Number(l.conhecimento > 0) + Number(l.profissionais > 0) + Number(l.robo);
  if (passos === 0) return { cor: "vermelho", texto: "Não preencheu nada" };
  if (!l.whatsapp || l.conversas_7d === 0) return { cor: "amarelo", texto: `${passos} de 4 passos · sem conversas na semana` };
  return { cor: "verde", texto: `${l.conversas_7d} conversa${l.conversas_7d === 1 ? "" : "s"} na semana` };
}

const COR = {
  vermelho: "border-coral/50",
  amarelo: "border-amber/40",
  verde: "border-teal/40",
} as const;

const SELO = {
  vermelho: "bg-coral/10 text-coral",
  amarelo: "bg-amber/15 text-[#7a4a00]",
  verde: "bg-teal/10 text-teal",
} as const;

/** Painel do Rescue no /admin: quem precisa de atenção primeiro e o que o Rescue já fez. */
export default async function RescuePainel({ supabase }: { supabase: SupabaseClient }) {
  const [{ data, error }, { data: eventosData }] = await Promise.all([
    supabase.rpc("rescue_painel"),
    supabase.from("rescue_eventos").select("tipo, etapa, canal, email, created_at, detalhe").order("created_at", { ascending: false }).limit(15),
  ]);

  if (error) {
    return (
      <div className="card mb-6 border-amber/40 px-4 py-3 text-[13px]">
        <p className="font-bold">Rescue</p>
        <p className="text-ink-soft">O painel do Rescue aparece depois que a migração supabase-migrations/2026-10-27_rescue.sql for aplicada no banco.</p>
      </div>
    );
  }

  const linhas = ((data ?? []) as Linha[])
    .map((l) => ({ ...l, s: saude(l) }))
    .sort((a, b) => {
      const ordem = { vermelho: 0, amarelo: 1, verde: 2 };
      return ordem[a.s.cor] - ordem[b.s.cor] || b.dias - a.dias;
    });
  const eventos = (eventosData ?? []) as Evento[];
  const contagem = { vermelho: 0, amarelo: 0, verde: 0 };
  for (const l of linhas) contagem[l.s.cor]++;

  return (
    <div className="mb-6">
      <p className="mb-1 text-[14px] font-bold">
        Rescue: sucesso dos clientes <span className="font-normal text-ink-faint">({linhas.length})</span>
      </p>
      <p className="mb-3 text-[12px] text-ink-faint">
        {contagem.vermelho} sem preencher nada · {contagem.amarelo} começaram e ainda não atendem · {contagem.verde} atendendo. Quem não preencheu nada recebe e-mail no dia 5, 10, 15, até o dia 30; o WhatsApp abaixo sai com a mensagem pronta (o envio automático depende da aprovação da Meta).
      </p>
      <div className="flex flex-col gap-2">
        {linhas.slice(0, 40).map((l) => {
          const etapa = Math.max(1, Math.min(6, Math.floor(l.dias / 5)));
          const zap = linkWhatsapp(l.telefone, mensagemWhatsappOnboarding({ nome: l.dono_nome, negocio: l.negocio, segmento: l.segmento, etapa }));
          const est = estimativaGanho(l.segmento);
          return (
            <div key={l.tenant_id} className={`card flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${COR[l.s.cor]}`}>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold">
                  {l.negocio} <span className="font-normal text-ink-faint">· {nomePlano(l.plano)}{l.plano_bonus && l.plano_bonus_ate ? ` (presente até ${new Date(l.plano_bonus_ate).toLocaleDateString("pt-BR")})` : ""}</span>
                </p>
                <p className="text-[12px] text-ink-faint">
                  {l.dono_nome ?? "?"} · {l.dono_email ?? "sem e-mail"} · {l.dias} dia{l.dias === 1 ? "" : "s"} de conta · potencial {brl(est.total)}/mês
                </p>
                <p className="text-[12px] text-ink-faint">
                  WhatsApp {l.whatsapp ? "✓" : "✗"} · conhecimento {l.conhecimento} · profissionais {l.profissionais} · robô {l.robo ? "✓" : "✗"} · agendamentos {l.agendamentos}
                  {l.contatos > 0 && l.ultimo_contato ? ` · Rescue: ${l.contatos} contato${l.contatos === 1 ? "" : "s"}, último em ${new Date(l.ultimo_contato).toLocaleDateString("pt-BR")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {l.presente === "implantacao" && <span className="rounded-full bg-purple/10 px-2.5 py-0.5 text-[11px] font-bold text-purple">Presente: configurar com ele</span>}
                {l.presente === "upgrade" && <span className="rounded-full bg-purple/10 px-2.5 py-0.5 text-[11px] font-bold text-purple">Presente: plano acima</span>}
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${SELO[l.s.cor]}`}>{l.s.texto}</span>
                {zap && l.s.cor !== "verde" && (
                  <a href={zap} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-teal hover:underline">
                    WhatsApp pronto
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {eventos.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[12.5px] font-bold text-ink-soft">Últimas ações do Rescue</p>
          <div className="card divide-y divide-border">
            {eventos.map((e, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[12.5px]">
                <span className="font-semibold">
                  {ROTULO_EVENTO[e.tipo] ?? e.tipo}
                  {e.etapa > 1 ? ` (${e.etapa}º)` : ""}
                  {e.email ? <span className="font-normal text-ink-faint"> · {e.email}</span> : null}
                </span>
                <span className="text-ink-faint">
                  {e.canal === "email" ? "e-mail" : e.canal === "sistema" ? "automático" : "WhatsApp"} · {new Date(e.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

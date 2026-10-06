import Link from "next/link";
import { ArrowRight, BookOpen, Bot, CalendarCheck, Check, MessageCircle, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Passo = {
  titulo: string;
  texto: string;
  href: string;
  feito: boolean;
  icon: typeof Bot;
};

/** Checklist de ativação do negócio. Some sozinho quando tudo está pronto. */
export default async function PrimeirosPassos() {
  const supabase = await createClient();

  const [{ data: conta }, { count: conhecimento }, { count: profissionais }, { data: botCfg }, { count: agendamentos }] =
    await Promise.all([
      supabase.from("whatsapp_accounts").select("status").maybeSingle(),
      supabase.from("knowledge_base").select("id", { count: "exact", head: true }),
      supabase.from("professionals").select("id", { count: "exact", head: true }),
      supabase.from("bot_settings").select("updated_at").maybeSingle(),
      supabase.from("appointments").select("id", { count: "exact", head: true }),
    ]);

  const passos: Passo[] = [
    {
      titulo: "Conectar o WhatsApp",
      texto: "Ligue o número do seu negócio para o robô começar a atender.",
      href: "/canais",
      feito: conta?.status === "ativo",
      icon: MessageCircle,
    },
    {
      titulo: "Ensinar o robô sobre o seu negócio",
      texto: "Preços, horários, regras e serviços, em blocos fáceis de atualizar.",
      href: "/base-conhecimento",
      feito: (conhecimento ?? 0) > 0,
      icon: BookOpen,
    },
    {
      titulo: "Cadastrar profissionais e agenda",
      texto: "O robô só marca horários de quem estiver cadastrado.",
      href: "/calendario",
      feito: (profissionais ?? 0) > 0,
      icon: Users,
    },
    {
      titulo: "Revisar a personalidade e as regras",
      texto: "Pós-venda, lembretes, reengajamento e avaliação no Google.",
      href: "/robo",
      feito: !!botCfg,
      icon: Bot,
    },
    {
      titulo: "Receber o primeiro agendamento",
      texto: "Quando um cliente marcar horário, este passo se completa sozinho.",
      href: "/conversas",
      feito: (agendamentos ?? 0) > 0,
      icon: CalendarCheck,
    },
  ];

  const feitos = passos.filter((p) => p.feito).length;
  if (feitos === passos.length) return null;
  const proximo = passos.find((p) => !p.feito);

  return (
    <section className="card mb-5 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-[16px] font-extrabold">Primeiros passos</h2>
          <p className="text-[12.5px] text-ink-soft">
            {feitos} de {passos.length} concluídos. Faltam poucos passos para o robô atender por você.
          </p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-[240px]">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={feitos} aria-valuemin={0} aria-valuemax={passos.length}>
            <div className="h-full rounded-full bg-purple" style={{ width: `${(feitos / passos.length) * 100}%` }} />
          </div>
          <span className="text-[12px] font-bold text-ink-soft">{Math.round((feitos / passos.length) * 100)}%</span>
        </div>
      </header>
      <ul className="grid gap-px bg-border md:grid-cols-5">
        {passos.map((p) => {
          const Icon = p.icon;
          const destaque = p === proximo;
          return (
            <li key={p.titulo} className="bg-surface">
              <Link href={p.href} className={`flex h-full flex-col gap-2 px-4 py-4 hover:bg-surface-soft ${destaque ? "bg-[#f6f4fe]" : ""}`}>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    p.feito ? "bg-[#e3f4ef] text-teal" : destaque ? "bg-purple text-white" : "bg-surface-soft text-ink-soft"
                  }`}
                >
                  {p.feito ? <Check size={18} strokeWidth={2.6} /> : <Icon size={17} />}
                </span>
                <p className={`text-[13px] font-bold leading-tight ${p.feito ? "text-ink-soft line-through decoration-ink-faint/50" : ""}`}>{p.titulo}</p>
                <p className="text-[12px] leading-snug text-ink-soft">{p.texto}</p>
                {destaque && (
                  <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-bold text-purple">
                    Continuar <ArrowRight size={13} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import Link from "next/link";
import { Camera, CheckCircle2, Mail, MessageCircle, MessagesSquare, Plug, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { desconectarWhatsApp } from "../conta/actions";
import EmbeddedSignupButton from "../conta/embedded-signup-button";

const EM_BREVE = [
  { nome: "Instagram", texto: "Atender as mensagens diretas do Instagram com o mesmo robô.", icon: Camera },
  { nome: "Facebook Messenger", texto: "Responder quem chama pela página do Facebook.", icon: MessagesSquare },
  { nome: "E-mail", texto: "Campanhas e avisos por e-mail, no mesmo painel.", icon: Mail },
];

const PASSOS = [
  {
    titulo: "Antes de começar",
    texto: "Tenha à mão: um perfil do Facebook que administre a sua empresa e o celular com o número do negócio (ele vai receber um código de confirmação).",
  },
  {
    titulo: "Conectar o número",
    texto: "Clique em “Conectar WhatsApp” abaixo e siga a janela da Meta. Ela pede login no Facebook, escolha da empresa e confirmação do número.",
  },
  {
    titulo: "Testar de verdade",
    texto: "Do seu celular pessoal, mande uma mensagem para o número do negócio. A conversa aparece na Caixa de atendimento e o robô responde.",
  },
  {
    titulo: "Revisar e deixar rodando",
    texto: "Confira a base de conhecimento e a personalidade do robô. Use o Simulador para ver como ele responde antes de divulgar o número.",
  },
];

export default async function CanaisPage() {
  const supabase = await createClient();
  const { data: conta } = await supabase
    .from("whatsapp_accounts")
    .select("display_phone_number, phone_number_id, status, connected_at, qualidade_atual, is_coexistence")
    .maybeSingle();

  const ativo = conta?.status === "ativo";
  const erro = conta?.status === "erro";

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-[22px] font-extrabold">
          <Plug size={22} className="text-purple" /> Canais
        </h1>
        <p className="text-[13.5px] text-ink-soft">Por onde o seu robô conversa com os clientes.</p>
      </div>

      <section className="card mb-5 overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f4ef] text-teal">
              <MessageCircle size={20} />
            </span>
            <div>
              <h2 className="text-[15px] font-extrabold leading-tight">WhatsApp Business</h2>
              <p className="text-[12.5px] text-ink-soft">Canal principal de atendimento</p>
            </div>
          </div>
          {ativo && (
            <span className="badge badge-success">
              <CheckCircle2 size={12} /> Conectado
            </span>
          )}
          {erro && (
            <span className="badge badge-danger">
              <TriangleAlert size={12} /> Com problema
            </span>
          )}
          {!conta && <span className="badge badge-neutral">Não conectado</span>}
          {conta && !ativo && !erro && <span className="badge badge-warn">Desconectado</span>}
        </header>

        {conta ? (
          <div className="px-5 py-5">
            <dl className="grid gap-4 text-[13px] sm:grid-cols-3">
              <div>
                <dt className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Número</dt>
                <dd className="mt-1 font-bold">{conta.display_phone_number ?? conta.phone_number_id}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Conectado em</dt>
                <dd className="mt-1 font-bold">{new Date(conta.connected_at).toLocaleDateString("pt-BR")}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">Qualidade do número</dt>
                <dd className="mt-1 font-bold">{conta.qualidade_atual ?? "Não informada"}</dd>
              </div>
            </dl>
            {erro && (
              <p className="mt-4 rounded-lg bg-[#fdece9] px-3.5 py-2.5 text-[12.5px] font-semibold text-coral">
                O WhatsApp parou de enviar mensagens. Desconecte e conecte de novo para restabelecer o atendimento.
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link href="/robo/simulador" className="btn btn-primary btn-md">
                Testar o robô
              </Link>
              <Link href="/conversas" className="btn btn-secondary btn-md">
                Abrir a caixa de atendimento
              </Link>
              <form action={desconectarWhatsApp} className="sm:ml-auto">
                <button type="submit" className="btn btn-ghost btn-md !text-coral">
                  Desconectar
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5">
            <ol className="mb-6 grid gap-3 md:grid-cols-4">
              {PASSOS.map((p, i) => (
                <li key={p.titulo} className="rounded-xl border border-border bg-bg px-4 py-3.5">
                  <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-purple text-[12.5px] font-extrabold text-white">{i + 1}</span>
                  <p className="text-[13px] font-extrabold leading-tight">{p.titulo}</p>
                  <p className="mt-1 text-[12px] leading-snug text-ink-soft">{p.texto}</p>
                </li>
              ))}
            </ol>
            <EmbeddedSignupButton />
            <p className="mt-4 text-[12px] text-ink-faint">
              Prefere conectar com os seus próprios dados de desenvolvedor da Meta? A opção manual continua disponível em{" "}
              <Link href="/conta" className="font-bold text-purple underline-offset-2 hover:underline">
                Conta e assinatura
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      <h2 className="mb-3 text-[14px] font-extrabold">Outros canais</h2>
      <div className="grid gap-3.5 md:grid-cols-3">
        {EM_BREVE.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.nome} className="card px-5 py-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-soft text-ink-soft">
                  <Icon size={18} />
                </span>
                <span className="badge badge-neutral">Em breve</span>
              </div>
              <p className="text-[13.5px] font-extrabold">{c.nome}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-soft">{c.texto}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

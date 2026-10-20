import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatPublico from "./chat-publico";

export const metadata = { title: "Converse com o atendimento", robots: { index: false, follow: false } };

export default async function RoboPublicoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("robo_publico_contexto", { p_codigo: codigo });
  const c = data as { negocio: string; assistente: string } | null;
  if (!c) notFound();
  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col px-4 py-8">
      <h1 className="text-[20px] font-extrabold">{c.negocio}</h1>
      <p className="mt-1 text-[13px] text-[#6b6577]">Tire suas dúvidas com o nosso assistente virtual. Para agendar, fale com a gente pelo WhatsApp.</p>
      <ChatPublico codigo={codigo} nome={c.assistente || "Assistente"} />
      <p className="mt-6 text-center text-[11.5px] text-[#8a8896]">Atendimento por IA com a tecnologia ivva. As respostas podem conter erros; confirme valores e horários com o negócio.</p>
    </main>
  );
}

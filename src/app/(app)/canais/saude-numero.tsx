import { createClient } from "@/lib/supabase/server";
import { consultarSaudeNumero } from "@/lib/whatsapp";

const QUALIDADE: Record<string, { label: string; badge: string; dica: string }> = {
  GREEN: { label: "Boa", badge: "badge-success", dica: "Seus clientes estão recebendo bem as mensagens." },
  YELLOW: { label: "Atenção", badge: "badge-warn", dica: "Alguns clientes bloquearam ou denunciaram. Pause as divulgações por alguns dias e mande só para quem pediu." },
  RED: { label: "Ruim", badge: "badge-danger", dica: "Muitos bloqueios ou denúncias. Pare as campanhas agora: a Meta pode reduzir o seu limite." },
};

const LIMITE: Record<string, string> = {
  TIER_50: "50 clientes novos por dia",
  TIER_250: "250 clientes novos por dia",
  TIER_1K: "1.000 clientes novos por dia",
  TIER_2K: "2.000 clientes novos por dia",
  TIER_10K: "10.000 clientes novos por dia",
  TIER_100K: "100.000 clientes novos por dia",
  TIER_UNLIMITED: "Sem limite",
};

/** Saúde do número: nota de qualidade e quantos clientes novos dá para chamar por dia. */
export default async function SaudeNumero() {
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!secret) return null;
  const supabase = await createClient();
  const { data: contas } = await supabase.rpc("whatsapp_conta_atual_srv", { p_secret: secret });
  const conta = (contas as { phone_number_id?: string; access_token?: string }[] | null)?.[0];
  if (!conta?.phone_number_id || !conta.access_token) return null;

  const saude = await consultarSaudeNumero(conta.phone_number_id, conta.access_token);
  if (!saude) return null;
  const q = saude.qualidade ? QUALIDADE[saude.qualidade] : null;

  return (
    <div className="mt-5 rounded-xl border border-border bg-bg px-4 py-3.5">
      <p className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Saúde do número (direto da Meta)</p>
      <dl className="mt-2.5 grid gap-4 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-[12px] text-ink-soft">Qualidade</dt>
          <dd className="mt-1">
            {q ? <span className={`badge ${q.badge}`}>{q.label}</span> : <span className="font-bold">Ainda sem nota</span>}
          </dd>
          <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">{q ? q.dica : "A Meta dá a nota depois que o número começa a conversar."}</p>
        </div>
        <div>
          <dt className="text-[12px] text-ink-soft">Limite de conversas que você inicia</dt>
          <dd className="mt-1 font-bold">{saude.limite ? LIMITE[saude.limite] ?? saude.limite : "Não informado"}</dd>
          <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">
            Vale para campanhas e lembretes fora das 24 horas. Responder quem te chamou não conta. O limite sobe sozinho com bom uso.
          </p>
        </div>
      </dl>
    </div>
  );
}

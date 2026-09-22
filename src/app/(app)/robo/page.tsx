import { createClient } from "@/lib/supabase/server";
import AssistantForm from "./assistant-form";
import BotSettingsForm from "./bot-settings-form";

export default async function RoboPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("users")
    .select("role, tenants(identidade_assistente)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const isDono = perfil?.role === "dono";

  const tenant = perfil?.tenants as unknown as {
    identidade_assistente: {
      nome_assistente?: string;
      tom?: string;
      regras?: string[];
      horario_atendimento?: string;
      voz?: string;
    } | null;
  } | null;

  if (!isDono) {
    return (
      <div>
        <h1 className="font-display text-[22px] font-extrabold">
          Configuração do robô
        </h1>
        <div className="card mt-5 px-6 py-14 text-center text-[13px] text-ink-faint">
          Só o dono do negócio configura o robô.
        </div>
      </div>
    );
  }

  const [{ data: conta }, { data: botSettings }] = await Promise.all([
    supabase
      .from("whatsapp_accounts")
      .select("id, is_coexistence")
      .maybeSingle(),
    // Ainda não existe linha pra todo tenant (só é criada quando o dono
    // salva pela primeira vez) — maybeSingle cobre o caso de não existir.
    supabase.from("bot_settings").select("*").maybeSingle(),
  ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold">
          Configuração do robô
        </h1>
        <p className="text-[13.5px] text-ink-soft">
          Como a ivva conversa, vende e trabalha por você no WhatsApp.
        </p>
      </div>

      {!conta && (
        <a
          href="/conta"
          className="mb-4 block rounded-[12px] border border-purple/30 bg-purple/5 px-4 py-3 text-[13px] font-semibold text-purple"
        >
          Seu WhatsApp ainda não está conectado — pode configurar tudo aqui
          antes, mas o robô só atende de verdade depois de conectar em
          Conta e assinatura →
        </a>
      )}

      {conta?.is_coexistence && (
        <div className="mb-4 rounded-[12px] border border-coral/30 bg-coral/5 px-4 py-3.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-extrabold text-coral">
            ⚠️ Observação — WhatsApp conectado em modo "app + ivva juntos"
          </p>
          <p className="text-[12.5px] leading-relaxed text-ink">
            Seu número continua funcionando no app do WhatsApp Business do
            celular ao mesmo tempo que a ivva atende por ele. Combine isso
            com sua equipe antes de usar:
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-[12.5px] leading-relaxed text-ink">
            <li>Conversas em <b>grupo</b> não sincronizam com a ivva.</li>
            <li>
              Mensagens de <b>&quot;ver uma vez&quot;</b> e{" "}
              <b>localização ao vivo</b> ficam desativadas.
            </li>
            <li>
              <b>Listas de transmissão</b> viram só-leitura — não dá mais
              pra criar novas pelo app.
            </li>
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card px-5 py-5">
          <p className="mb-1 text-[14px] font-bold">
            Personalidade do atendimento
          </p>
          <p className="mb-3 text-[12px] text-ink-faint">
            Como a ivva se apresenta e conversa com seus clientes no
            WhatsApp.
          </p>
          <AssistantForm identidade={tenant?.identidade_assistente ?? null} />
        </div>

        <div className="card px-5 py-5">
          <p className="mb-1 text-[14px] font-bold">
            Pós-venda, vendas e automações
          </p>
          <p className="mb-4 text-[12px] text-ink-faint">
            Pós-venda, reengajamento, aniversário e o canal de comandos que
            você usa pra falar com o robô como dono.
          </p>
          <BotSettingsForm settings={botSettings} />
        </div>
      </div>
    </div>
  );
}

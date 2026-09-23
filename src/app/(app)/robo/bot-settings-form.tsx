"use client";

import { useActionState } from "react";
import { atualizarBotSettings } from "./actions";
import { FeatureLock } from "@/components/feature-lock";

type BotSettings = {
  pos_venda_ativo: boolean;
  pos_venda_delay: string;
  pos_venda_mensagem: string | null;
  pedir_instagram_primeiro_contato: boolean;
  pedir_email_primeiro_contato: boolean;
  reengajamento_ativo: boolean;
  reengajamento_dias_inatividade: number;
  link_avaliacao_google: string | null;
  aniversario_ativo: boolean;
  aniversario_dias_antecedencia: number;
  aniversario_mensagem: string | null;
  admin_whatsapp_numero: string | null;
  admin_pin_hash: string | null;
  upsell_template_nome: string | null;
  bot_pausado: boolean;
  lista_espera_ativo: boolean;
  recuperar_conversa_ativo: boolean;
  recuperar_conversa_primeiro_toque_min: number;
  indicacao_recompensa_ativo: boolean;
  indicacao_recompensa_texto: string | null;
  responder_audio_ativo: boolean;
} | null;

export default function BotSettingsForm({
  settings,
  audioLiberado,
}: {
  settings: BotSettings;
  audioLiberado: boolean;
}) {
  const [error, formAction, pending] = useActionState(
    atualizarBotSettings,
    undefined,
  );

  const s = settings;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section className="rounded-[14px] border border-teal/30 bg-teal/5 px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <svg
            className="icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            style={{ color: "var(--teal)" }}
          >
            <path d="M3 12l9-9 9 9M5 10v10h14V10" />
            <path d="M9 14v3M12 12v5M15 15v2" />
          </svg>
          <p className="text-[14px] font-bold">Vendas e receita</p>
        </div>
        <p className="mb-4 text-[12px] text-ink-soft">
          Mecanismos que recuperam venda que normalmente se perde — sem
          você precisar lembrar de ninguém.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
              <input
                type="checkbox"
                name="recuperar_conversa_ativo"
                defaultChecked={s?.recuperar_conversa_ativo ?? true}
              />
              Recuperar conversa esfriada
            </label>
            <p className="mb-2 text-[11.5px] text-ink-faint">
              Cliente pergunta preço/horário e some sem confirmar — a ivva
              manda um toque leve depois de um tempo e, se ainda assim não
              responder, um segundo toque mais suave 24h depois. Sem
              resposta nos dois, vira tarefa pra você em Tarefas.
            </p>
            <label htmlFor="recuperar_conversa_primeiro_toque_min" className="!mb-1">
              1º toque depois de quantos minutos
            </label>
            <input
              id="recuperar_conversa_primeiro_toque_min"
              name="recuperar_conversa_primeiro_toque_min"
              type="number"
              min={5}
              defaultValue={s?.recuperar_conversa_primeiro_toque_min ?? 45}
              className="w-32 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>

          <div className="border-t border-teal/20 pt-4">
            <label className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
              <input
                type="checkbox"
                name="lista_espera_ativo"
                defaultChecked={s?.lista_espera_ativo ?? true}
              />
              Lista de espera automática
            </label>
            <p className="text-[11.5px] text-ink-faint">
              Quando não há vaga no horário que o cliente quer, a ivva
              oferece entrar na lista de espera daquele profissional.
              Assim que alguém cancela, ela avisa automaticamente o
              próximo da fila — sem essa vaga ficar perdida.
            </p>
          </div>

          <div className="border-t border-teal/20 pt-4">
            <label className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
              <input
                type="checkbox"
                name="indicacao_recompensa_ativo"
                defaultChecked={s?.indicacao_recompensa_ativo ?? false}
              />
              Recompensa por indicação
            </label>
            <p className="mb-2 text-[11.5px] text-ink-faint">
              Quando um cliente diz que foi indicado por alguém, a ivva
              pergunta o nome de quem indicou e registra no CRM. Se
              ativado, ela também conta a recompensa pro novo cliente na
              hora — a recompensa de quem indicou fica registrada no CRM
              pra você conferir e aplicar (por segurança, a ivva não manda
              mensagem automática pra quem indicou, já que o nome sozinho
              pode ser ambíguo).
            </p>
            <label htmlFor="indicacao_recompensa_texto" className="!mb-1">
              Texto da recompensa (mostrado pro novo cliente)
            </label>
            <input
              id="indicacao_recompensa_texto"
              name="indicacao_recompensa_texto"
              placeholder="Ex: 10% de desconto pra quem indicou e pra quem foi indicado"
              defaultValue={s?.indicacao_recompensa_texto ?? ""}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border pt-4">
        <FeatureLock
          liberado={audioLiberado}
          titulo="Resposta por áudio"
          planoNecessario="Profissional"
          variante="list"
          className="px-4 py-4"
        >
          <p className="mb-2 text-[13px] font-bold">Resposta por áudio</p>
          <label className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
            <input
              type="checkbox"
              name="responder_audio_ativo"
              defaultChecked={s?.responder_audio_ativo ?? false}
            />
            Deixar a ivva responder em áudio quando fizer sentido
          </label>
          <p className="text-[11.5px] text-ink-faint">
            Quando o cliente manda 2 ou mais mensagens de voz seguidas, a
            ivva entende que ele prefere áudio e responde também em áudio —
            usando a voz configurada em Personalidade do atendimento. Se em
            algum momento não der pra gerar o áudio, ela responde em texto
            normalmente, sem deixar o cliente sem resposta.
          </p>
        </FeatureLock>
      </section>

      <section className="border-t border-border pt-4">
        <p className="mb-2.5 text-[13px] font-bold">Pós-venda</p>
        <label className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
          <input
            type="checkbox"
            name="pos_venda_ativo"
            defaultChecked={s?.pos_venda_ativo ?? true}
          />
          Perguntar como foi o atendimento depois de concluído
        </label>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label htmlFor="pos_venda_delay" className="!mb-1">
              Quanto tempo depois
            </label>
            <select
              id="pos_venda_delay"
              name="pos_venda_delay"
              defaultValue={s?.pos_venda_delay ?? "1d"}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            >
              <option value="1h">1 hora</option>
              <option value="2h">2 horas</option>
              <option value="1d">1 dia</option>
              <option value="5d">5 dias</option>
              <option value="nunca">Nunca perguntar</option>
            </select>
          </div>
          <div>
            <label htmlFor="link_avaliacao_google" className="!mb-1">
              Link de avaliação do Google
            </label>
            <input
              id="link_avaliacao_google"
              name="link_avaliacao_google"
              placeholder="https://g.page/r/..."
              defaultValue={s?.link_avaliacao_google ?? ""}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>
        </div>
        <div className="mt-2">
          <label htmlFor="pos_venda_mensagem" className="!mb-1">
            Mensagem de pós-venda (opcional — use {"{nome}"} e {"{servico}"})
          </label>
          <textarea
            id="pos_venda_mensagem"
            name="pos_venda_mensagem"
            rows={2}
            placeholder="Oi {nome}! Como foi seu {servico} com a gente?"
            defaultValue={s?.pos_venda_mensagem ?? ""}
            className="w-full resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
          />
        </div>
      </section>

      <section className="border-t border-border pt-4">
        <p className="mb-2.5 text-[13px] font-bold">Primeiro contato</p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[12.5px] font-semibold">
            <input
              type="checkbox"
              name="pedir_email_primeiro_contato"
              defaultChecked={s?.pedir_email_primeiro_contato ?? true}
            />
            Perguntar e-mail
          </label>
          <label className="flex items-center gap-2 text-[12.5px] font-semibold">
            <input
              type="checkbox"
              name="pedir_instagram_primeiro_contato"
              defaultChecked={s?.pedir_instagram_primeiro_contato ?? true}
            />
            Perguntar Instagram
          </label>
        </div>
      </section>

      <section className="border-t border-border pt-4">
        <p className="mb-2.5 text-[13px] font-bold">Reengajamento</p>
        <label className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
          <input
            type="checkbox"
            name="reengajamento_ativo"
            defaultChecked={s?.reengajamento_ativo ?? false}
          />
          Criar tarefa de reengajamento pra clientes inativos
        </label>
        <div>
          <label htmlFor="reengajamento_dias_inatividade" className="!mb-1">
            Dias sem contato pra considerar inativo
          </label>
          <input
            id="reengajamento_dias_inatividade"
            name="reengajamento_dias_inatividade"
            type="number"
            min={1}
            defaultValue={s?.reengajamento_dias_inatividade ?? 60}
            className="w-32 rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
          />
        </div>
      </section>

      <section className="border-t border-border pt-4">
        <p className="mb-2.5 text-[13px] font-bold">Aniversário</p>
        <label className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
          <input
            type="checkbox"
            name="aniversario_ativo"
            defaultChecked={s?.aniversario_ativo ?? false}
          />
          Mandar mensagem de aniversário
        </label>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label htmlFor="aniversario_dias_antecedencia" className="!mb-1">
              Dias de antecedência (0 = no dia)
            </label>
            <input
              id="aniversario_dias_antecedencia"
              name="aniversario_dias_antecedencia"
              type="number"
              min={0}
              defaultValue={s?.aniversario_dias_antecedencia ?? 0}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label htmlFor="aniversario_mensagem" className="!mb-1">
              Mensagem (opcional)
            </label>
            <input
              id="aniversario_mensagem"
              name="aniversario_mensagem"
              placeholder="Feliz aniversário, {nome}! 🎉"
              defaultValue={s?.aniversario_mensagem ?? ""}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border pt-4">
        <p className="mb-1 text-[13px] font-bold">Canal do dono (comandos via WhatsApp)</p>
        <p className="mb-2.5 text-[12px] text-ink-faint">
          Cadastre seu número e um PIN pra dar comandos ao robô direto pelo
          WhatsApp (criar promoção, chamar cliente, ver resumo do dia...).
          Usamos PIN em vez de senha porque uma senha digitada no WhatsApp
          fica gravada pra sempre naquele chat — o PIN prova que é você sem
          esse risco.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label htmlFor="admin_whatsapp_numero" className="!mb-1">
              Seu número (com DDD)
            </label>
            <input
              id="admin_whatsapp_numero"
              name="admin_whatsapp_numero"
              placeholder="5511999998888"
              defaultValue={s?.admin_whatsapp_numero ?? ""}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label htmlFor="admin_pin" className="!mb-1">
              {s?.admin_pin_hash ? "Trocar PIN (deixe em branco pra manter)" : "Criar PIN (4-6 dígitos)"}
            </label>
            <input
              id="admin_pin"
              name="admin_pin"
              type="password"
              inputMode="numeric"
              placeholder="••••"
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
            />
          </div>
        </div>
        {s?.bot_pausado && (
          <p className="mt-2.5 text-[12px] font-semibold text-coral">
            ⚠️ O robô está pausado agora (você pausou pelo canal do dono). Toda
            conversa nova está indo direto pra atendimento humano.
          </p>
        )}
        <div className="mt-3">
          <label htmlFor="upsell_template_nome" className="!mb-1">
            Nome do template aprovado pra disparo em massa (opcional)
          </label>
          <input
            id="upsell_template_nome"
            name="upsell_template_nome"
            placeholder="ex: promocao_mensal"
            defaultValue={s?.upsell_template_nome ?? ""}
            className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px]"
          />
          <p className="mt-1 text-[11.5px] text-ink-faint">
            Sem isso, o comando &quot;disparar oferta em massa&quot; pelo canal do
            dono não funciona — a Meta só deixa o negócio iniciar conversa com
            quem não falou nas últimas 24h usando um template de mensagem
            aprovado por eles (não é algo que a ivva resolve sozinha, precisa
            ser submetido e aprovado no Meta Business).
          </p>
        </div>
      </section>

      {error && (
        <p className="text-[12.5px] font-semibold text-coral">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn justify-center bg-ink py-2.5 text-[13px] text-white disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar configurações do robô"}
      </button>
    </form>
  );
}

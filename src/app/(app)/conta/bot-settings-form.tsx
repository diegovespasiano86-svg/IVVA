"use client";

import { useActionState } from "react";
import { atualizarBotSettings } from "./actions";

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
} | null;

export default function BotSettingsForm({ settings }: { settings: BotSettings }) {
  const [error, formAction, pending] = useActionState(
    atualizarBotSettings,
    undefined,
  );

  const s = settings;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section>
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

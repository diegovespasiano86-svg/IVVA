import { createClient } from "@supabase/supabase-js";
import { enviarEmail } from "./email";

// Resumo semanal por e-mail para o dono: o que a ivva fez nos últimos 7 dias.
// Roda às segundas, pegando carona no cron diário (o plano Hobby da Vercel só permite 2 crons).

type Linha = {
  tenant_id: string;
  negocio: string;
  email: string;
  dono_nome: string | null;
  conversas: number;
  humano: number;
  agendamentos: number;
  novos_contatos: number;
  faturamento: number;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brl = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function emailResumoSemanal(l: Linha) {
  const primeiro = (l.dono_nome ?? "").trim().split(/\s+/)[0];
  const resolvidas = Math.max(0, l.conversas - l.humano);
  const assunto = `Seu resumo da semana na ivva: ${l.conversas} ${l.conversas === 1 ? "conversa" : "conversas"}, ${l.agendamentos} ${l.agendamentos === 1 ? "agendamento" : "agendamentos"}`;
  const itens: [string, string][] = [
    ["Conversas", String(l.conversas)],
    ["Resolvidas pelo robô", String(resolvidas)],
    ["Agendamentos novos", String(l.agendamentos)],
    ["Novos contatos", String(l.novos_contatos)],
    ["Faturamento registrado", brl(l.faturamento)],
  ];
  const linhasHtml = itens
    .map(([k, v]) => `<tr><td style="padding:8px 0;color:#6b6577;font-size:14px">${esc(k)}</td><td style="padding:8px 0;text-align:right;font-weight:700;font-size:15px;color:#241f2e">${esc(v)}</td></tr>`)
    .join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#241f2e">
<h1 style="font-size:20px;margin:0 0 4px">Oi${primeiro ? ", " + esc(primeiro) : ""}!</h1>
<p style="margin:0 0 16px;color:#6b6577;font-size:14px">Este foi o resumo dos últimos 7 dias de <b>${esc(l.negocio)}</b> na ivva.</p>
<table style="width:100%;border-collapse:collapse;border-top:1px solid #e6e1d8">${linhasHtml}</table>
<p style="margin:20px 0"><a href="https://app.ivva.app.br/dashboard" style="background:#6d5be0;color:#fff;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:700;font-size:14px;display:inline-block">Abrir o painel</a></p>
<p style="color:#8a8896;font-size:12px;line-height:1.5">Números do seu painel. Para parar de receber este resumo, responda este e-mail pedindo para desativar.</p>
</div>`;
  const texto = `Oi${primeiro ? ", " + primeiro : ""}! Resumo dos últimos 7 dias de ${l.negocio} na ivva:\n` + itens.map(([k, v]) => `- ${k}: ${v}`).join("\n") + `\n\nPainel: https://app.ivva.app.br/dashboard\nPara parar de receber, responda este e-mail pedindo para desativar.`;
  return { assunto, html, texto };
}

export async function enviarResumosSemanais(): Promise<{ enviados: number; pulados: number; falhas: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.WHATSAPP_WEBHOOK_INTERNAL_SECRET;
  if (!url || !anon || !secret) return { enviados: 0, pulados: 0, falhas: 0 };

  const { data, error } = await createClient(url, anon).rpc("resumo_semanal_listar", { p_secret: secret });
  if (error) {
    console.error("[resumo-semanal] falha ao listar", error.message);
    return { enviados: 0, pulados: 0, falhas: 1 };
  }

  let enviados = 0;
  let pulados = 0;
  let falhas = 0;
  for (const l of (data ?? []) as Linha[]) {
    // Semana sem nenhum movimento: não manda e-mail vazio.
    if (Number(l.conversas) === 0 && Number(l.agendamentos) === 0 && Number(l.novos_contatos) === 0) {
      pulados++;
      continue;
    }
    const r = await enviarEmail({
      para: l.email,
      ...emailResumoSemanal({
        ...l,
        conversas: Number(l.conversas),
        humano: Number(l.humano),
        agendamentos: Number(l.agendamentos),
        novos_contatos: Number(l.novos_contatos),
        faturamento: Number(l.faturamento),
      }),
    });
    r.ok ? enviados++ : falhas++;
  }
  return { enviados, pulados, falhas };
}

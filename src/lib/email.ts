// E-mails transacionais do app (hoje: convite de profissional). Usa a API do Resend com o
// domínio ivva.app.br já verificado. Precisa da variável RESEND_API_KEY (segredo, só na Vercel).
// Sem a chave, nada é enviado e quem chama mostra o link do convite para copiar.
import { ACESSOS, type PapelConvite } from "./acessos";

const RESEND_API = "https://api.resend.com/emails";
const REMETENTE = "ivva <nao-responda@ivva.app.br>";
const RESPONDER_PARA = "contato@ivva.app.br";

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function enviarEmail(params: {
  para: string;
  assunto: string;
  html: string;
  texto: string;
}): Promise<{ ok: boolean; motivo?: string }> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return { ok: false, motivo: "envio de e-mail ainda não configurado" };

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REMETENTE,
        to: [params.para],
        reply_to: RESPONDER_PARA,
        subject: params.assunto,
        html: params.html,
        text: params.texto,
      }),
    });
    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      console.error("[email] falha no envio", res.status, corpo.slice(0, 300));
      return { ok: false, motivo: "o envio do e-mail falhou" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] erro de rede no envio", err);
    return { ok: false, motivo: "o envio do e-mail falhou" };
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Convite para a pessoa criar a própria senha e acessar o sistema, com o tipo de acesso explicado. */
export function emailConviteProfissional(params: { nome: string; negocio: string; link: string; papel: PapelConvite }) {
  const nome = esc(params.nome);
  const negocio = esc(params.negocio);
  const link = esc(params.link);
  const acesso = ACESSOS[params.papel];
  const lista = (itens: string[]) => itens.map((i) => `<li style="margin:0 0 4px">${esc(i)}</li>`).join("");

  const assunto = `Você foi convidado(a) para a equipe de ${params.negocio} na ivva`;

  const texto = [
    `Olá, ${params.nome}!`,
    ``,
    `${params.negocio} convidou você para acessar a ivva, o sistema de atendimento e agenda da equipe.`,
    `Para criar sua senha e entrar, abra o link abaixo (vale por 7 dias):`,
    params.link,
    ``,
    `Seu acesso: ${acesso.rotulo}. ${acesso.resumo}`,
    ``,
    `Você poderá:`,
    ...acesso.pode.map((i) => `- ${i}`),
    ...(acesso.naoPode.length ? [``, `Fica com o administrador:`, ...acesso.naoPode.map((i) => `- ${i}`)] : []),
    ``,
    `Se você não esperava este convite, é só ignorar este e-mail.`,
  ].join("\n");

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#241f2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:.04em;color:#6d5be0">ivva</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">Você foi convidado(a) para a equipe de ${negocio}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Olá, ${nome}! ${negocio} convidou você para acessar a ivva, o sistema de atendimento e agenda da equipe.</p>
<p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#6d5be0;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px">Criar minha senha e entrar</a></p>
<p style="margin:0 0 6px;font-size:14px;font-weight:700">Seu acesso: ${esc(acesso.rotulo)}</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b6577">${esc(acesso.resumo)}</p>
<ul style="margin:0 0 12px;padding-left:18px;font-size:13px;line-height:1.5;color:#241f2e">${lista(acesso.pode)}</ul>
${acesso.naoPode.length ? `<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b6577">Fica com o administrador:</p><ul style="margin:0 0 12px;padding-left:18px;font-size:13px;line-height:1.5;color:#6b6577">${lista(acesso.naoPode)}</ul>` : ""}
<p style="margin:0 0 12px;font-size:12px;color:#8a8496">O convite vale por 7 dias.</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8496">Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all">${link}</span></p>
<p style="margin:20px 0 0;font-size:12px;color:#8a8496">Não esperava este convite? É só ignorar este e-mail.</p>
</td></tr></table></td></tr></table></body></html>`;

  return { assunto, html, texto };
}

const NOMES_PLANO: Record<string, string> = { essencial: "Essencial", profissional: "Profissional", completo: "Completo" };

function moldura(titulo: string, corpoHtml: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#241f2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:.04em;color:#6d5be0">ivva</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${esc(titulo)}</h1>
${corpoHtml}
</td></tr></table></td></tr></table></body></html>`;
}

const botao = (link: string, rotulo: string) =>
  `<p style="margin:0 0 24px"><a href="${esc(link)}" style="display:inline-block;background:#6d5be0;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px">${esc(rotulo)}</a></p>`;
const par = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${t}</p>`;
const nota = (t: string) => `<p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#8a8496">${t}</p>`;

/** Pagamento confirmado: falta o cliente criar a senha e escolher o tipo do negócio. */
export function emailFinalizarCadastro(params: { negocio: string; plano: string; link: string }) {
  const plano = NOMES_PLANO[params.plano] ?? params.plano;
  const assunto = "Pagamento confirmado: falta só criar a sua senha";
  const texto = [
    `Olá!`,
    ``,
    `Recebemos a assinatura do plano ${plano} para ${params.negocio}. Seus 14 dias de teste grátis já começaram.`,
    `Falta um passo: criar a sua senha e escolher o tipo do seu negócio. Leva 1 minuto:`,
    params.link,
    ``,
    `Se você já finalizou o cadastro, é só ignorar este e-mail. Qualquer dúvida, responda esta mensagem.`,
  ].join("\n");
  const html = moldura(
    "Pagamento confirmado: falta só criar a sua senha",
    par(`Recebemos a assinatura do plano <strong>${esc(plano)}</strong> para <strong>${esc(params.negocio)}</strong>. Seus 14 dias de teste grátis já começaram.`) +
      par("Falta um passo: criar a sua senha e escolher o tipo do seu negócio. Leva 1 minuto.") +
      botao(params.link, "Finalizar meu cadastro") +
      nota(`Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all">${esc(params.link)}</span>`) +
      nota("Já finalizou o cadastro? É só ignorar este e-mail. Qualquer dúvida, responda esta mensagem."),
  );
  return { assunto, html, texto };
}

/** O e-mail do pagamento já tem conta na ivva: orienta a entrar e avisa que a equipe vai ajudar. */
export function emailContaExistente(params: { email: string }) {
  const assunto = "Sua assinatura foi confirmada: use o seu acesso atual";
  const link = "https://app.ivva.app.br/login";
  const texto = [
    `Olá!`,
    ``,
    `Sua assinatura foi confirmada, mas o e-mail ${params.email} já tem uma conta na ivva.`,
    `Para usar, entre com esse e-mail em ${link}. Se esqueceu a senha, use "Esqueci minha senha" na mesma página.`,
    ``,
    `Se você queria abrir um novo negócio, responda este e-mail que a nossa equipe configura para você.`,
  ].join("\n");
  const html = moldura(
    "Sua assinatura foi confirmada",
    par(`O e-mail <strong>${esc(params.email)}</strong> já tem uma conta na ivva, então você usa o acesso que já existe.`) +
      botao(link, "Entrar na ivva") +
      par("Esqueceu a senha? Use &ldquo;Esqueci minha senha&rdquo; na tela de login.") +
      nota("Queria abrir um novo negócio? Responda este e-mail que a nossa equipe configura para você."),
  );
  return { assunto, html, texto };
}

/** Aviso interno: pagamentos que entraram e ainda não viraram uma conta. */
export function emailAlertaCadastros(itens: { email: string; nome_negocio: string | null; plano: string | null; status: string; criado_em: string }[]) {
  const rotulo = (s: string) => (s === "conta_existente" ? "e-mail já tem conta" : "cliente ainda não criou a senha");
  const linhas = itens.map((i) => `- ${i.email} | ${i.nome_negocio ?? "sem nome"} | plano ${i.plano ?? "?"} | ${rotulo(i.status)} | ${new Date(i.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
  const assunto = `[ivva] ${itens.length} pagamento(s) sem conta criada`;
  const texto = [`Pagamentos confirmados na Stripe que seguem sem negócio criado há mais de 30 minutos:`, ``, ...linhas, ``, `Veja em app.ivva.app.br/admin e fale com o cliente.`].join("\n");
  const html = moldura(
    `${itens.length} pagamento(s) sem conta criada`,
    par("Pagamentos confirmados na Stripe que seguem sem negócio criado há mais de 30 minutos:") +
      `<ul style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.6">${itens.map((i, k) => `<li>${esc(linhas[k].slice(2))}</li>`).join("")}</ul>` +
      nota("Veja em app.ivva.app.br/admin e fale com o cliente."),
  );
  return { assunto, html, texto };
}

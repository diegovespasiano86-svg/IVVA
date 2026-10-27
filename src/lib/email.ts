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
export function emailFinalizarCadastro(params: { negocio: string; plano: string; link: string; pix?: boolean }) {
  const plano = NOMES_PLANO[params.plano] ?? params.plano;
  const inicio = params.pix ? "O pagamento do Pix foi confirmado." : "Seus 14 dias de teste grátis já começaram.";
  const assunto = "Pagamento confirmado: falta só criar a sua senha";
  const texto = [
    `Olá!`,
    ``,
    `Recebemos a assinatura do plano ${plano} para ${params.negocio}. ${inicio}`,
    `Falta um passo: criar a sua senha e escolher o tipo do seu negócio. Leva 1 minuto:`,
    params.link,
    ``,
    `Se você já finalizou o cadastro, é só ignorar este e-mail. Qualquer dúvida, responda esta mensagem.`,
  ].join("\n");
  const html = moldura(
    "Pagamento confirmado: falta só criar a sua senha",
    par(`Recebemos a assinatura do plano <strong>${esc(plano)}</strong> para <strong>${esc(params.negocio)}</strong>. ${inicio}`) +
      par("Falta um passo: criar a sua senha e escolher o tipo do seu negócio. Em seguida você recebe um e-mail para confirmar o seu e-mail e ativar o acesso.") +
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

/**
 * Recuperação de cadastro abandonado (cron diário): etapa 1 no dia seguinte, etapa 2 três dias depois.
 * Quem já tem login na ivva não recebe (filtro no banco, leads_para_recuperar).
 */
export function emailRecuperarCadastro(params: { nome: string | null; negocio: string | null; plano: string | null; etapa: number }) {
  const link = "https://app.ivva.app.br/planos";
  const primeiroNome = (params.nome ?? "").trim().split(/\s+/)[0] || "";
  const ola = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  const plano = params.plano ? NOMES_PLANO[params.plano] ?? params.plano : null;
  const para = [plano ? `o plano ${plano}` : "a ivva", params.negocio ? `para ${params.negocio}` : ""].filter(Boolean).join(" ");
  const sair = "Não quer mais receber estes lembretes? Responda este e-mail com a palavra PARAR.";
  const ajuda = "Dúvidas? Fale com a gente no WhatsApp (11) 92740-9320 ou responda este e-mail.";

  if (params.etapa <= 1) {
    const assunto = "Seu cadastro na ivva ficou pela metade";
    const texto = [
      ola,
      ``,
      `Você começou a assinar ${para} e parou antes do pagamento.`,
      `Termina em 2 minutos: no cartão, os 14 primeiros dias são grátis e você cancela quando quiser, sem multa.`,
      link,
      ``,
      ajuda,
      sair,
    ].join("\n");
    const html = moldura(
      "Seu cadastro ficou pela metade",
      par(`${esc(ola)} Você começou a assinar <strong>${esc(para)}</strong> e parou antes do pagamento.`) +
        par("Termina em 2 minutos. No cartão, os <strong>14 primeiros dias são grátis</strong> e você cancela quando quiser, sem multa.") +
        botao(link, "Concluir meu cadastro") +
        nota(esc(ajuda)) +
        nota(esc(sair)),
    );
    return { assunto, html, texto };
  }

  const assunto = "Travou em alguma parte? A gente ajuda";
  const texto = [
    ola,
    ``,
    `Faz alguns dias que você começou a assinar ${para} e não concluiu.`,
    `Se ficou alguma dúvida sobre plano, pagamento ou como o robô responde, chame a gente no WhatsApp (11) 92740-9320: a gente te mostra funcionando com os dados do seu negócio.`,
    `Se preferir testar sozinho, a página de planos tem uma demonstração ao vivo:`,
    link,
    ``,
    sair,
  ].join("\n");
  const html = moldura(
    "Travou em alguma parte?",
    par(`${esc(ola)} Faz alguns dias que você começou a assinar <strong>${esc(para)}</strong> e não concluiu.`) +
      par("Se ficou alguma dúvida sobre plano, pagamento ou como o robô responde, chame a gente no WhatsApp <strong>(11) 92740-9320</strong>: a gente te mostra funcionando com os dados do seu negócio.") +
      par("Se preferir testar sozinho, a página de planos tem uma demonstração ao vivo.") +
      botao(link, "Ver a demonstração e concluir") +
      nota(esc(sair)),
  );
  return { assunto, html, texto };
}

/** Black Friday: acesso antecipado (20/11) para quem entrou na lista VIP. */
export function emailAcessoAntecipadoVip(params: { nome: string | null }) {
  const link = "https://app.ivva.app.br/planos";
  const primeiroNome = (params.nome ?? "").trim().split(/\s+/)[0] || "";
  const ola = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  const assunto = "Seu acesso antecipado à Black Friday da ivva abriu";
  const itens = [
    "30 dias grátis no cartão: cancelando antes do fim, nada é cobrado",
    "Plano anual com 40% de desconto",
    "Garantia de 7 dias: se não gostar, devolvemos 100% do valor pago",
    "Indique e ganhe: até 6 meses grátis",
  ];
  const sair = "Não quer mais receber nossos e-mails? Responda este e-mail com a palavra PARAR.";
  const ajuda = "Dúvidas? Fale com a gente no WhatsApp (11) 92740-9320 ou responda este e-mail.";
  const prazo = "Condições válidas para novas assinaturas até 30/11/2026. A abertura para todo mundo é só em 27/11.";
  const texto = [
    ola,
    ``,
    `Você está na lista VIP da Black Friday da ivva, então entra antes de todo mundo. Já está aberto:`,
    ...itens.map((i) => `- ${i}`),
    ``,
    link,
    ``,
    prazo,
    ajuda,
    sair,
  ].join("\n");
  const html = moldura(
    "Seu acesso antecipado abriu",
    par(`${esc(ola)} Você está na lista VIP da Black Friday da ivva, então entra <strong>antes de todo mundo</strong>. Já está aberto:`) +
      par(itens.map((i) => `• ${esc(i)}`).join("<br>")) +
      botao(link, "Garantir meu acesso VIP") +
      nota(esc(prazo)) +
      nota(esc(ajuda)) +
      nota(esc(sair)),
  );
  return { assunto, html, texto };
}

/**
 * Rescue: negócio que entrou e não preencheu nada. Etapa 1 = dia 5, 2 = dia 10, 3+ = a cada 5 dias até o dia 30.
 * A estimativa vem pronta de quem chama (lib/rescue.ts) e aparece sempre com a conta à mostra.
 */
export function emailOnboardingParado(params: {
  nome: string | null;
  negocio: string | null;
  etapa: number;
  estimativa: { ticket: number; atendimentos: number; total: number };
}) {
  const link = "https://app.ivva.app.br/base-conhecimento";
  const whats = "https://wa.me/5511927409320";
  const primeiro = (params.nome ?? "").trim().split(/\s+/)[0] || "";
  const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  const negocio = params.negocio || "o seu negócio";
  const real = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const { ticket, atendimentos, total } = params.estimativa;
  const conta = `Estimativa: ${atendimentos} atendimentos por mês que hoje se perdem por demora ou fora do horário × ${real(ticket)} de ticket médio de negócios como o seu.`;

  if (params.etapa <= 1) {
    const assunto = `Que bom ter ${negocio} na ivva! Falta um passo para o robô começar`;
    const texto = [
      ola,
      ``,
      `Estamos muito felizes com ${negocio} na ivva.`,
      `A ivva responde seus clientes em segundos, de dia e de noite, e pode trazer cerca de ${real(total)} a mais por mês.`,
      conta,
      ``,
      `Para isso, o robô precisa conhecer o seu negócio: serviços, preços, horários e regras. Leva uns 15 minutos:`,
      link,
      ``,
      `Prefere fazer junto com a gente? Chame no WhatsApp (11) 92740-9320 que a gente preenche com você.`,
    ].join("\n");
    const html = moldura(
      `Que bom ter ${negocio} na ivva!`,
      par(`${esc(ola)} Estamos muito felizes com <strong>${esc(negocio)}</strong> na ivva.`) +
        par(`A ivva responde seus clientes em segundos, de dia e de noite, e pode trazer cerca de <strong>${esc(real(total))} a mais por mês</strong>.`) +
        nota(esc(conta)) +
        par("Para isso, o robô precisa conhecer o seu negócio: serviços, preços, horários e regras. Leva uns 15 minutos.") +
        botao(link, "Ensinar o robô agora") +
        par(`Prefere fazer junto com a gente? <a href="${whats}" style="color:#6d5be0;font-weight:700">Chame no WhatsApp (11) 92740-9320</a> que a gente preenche com você.`),
    );
    return { assunto, html, texto };
  }

  if (params.etapa === 2) {
    const assunto = `O robô do ${negocio} ainda está esperando as suas informações`;
    const texto = [
      ola,
      ``,
      `O robô do ${negocio} ainda não tem as informações para atender os seus clientes.`,
      `Um atalho: mande um áudio de 2 minutos no nosso WhatsApp (11) 92740-9320 com serviços, preços e horários, e a nossa equipe preenche tudo para você.`,
      whats,
      ``,
      `Se preferir fazer sozinho: ${link}`,
      ``,
      `Cada mês sem o robô pode ser cerca de ${real(total)} que fica na mesa (${conta.replace("Estimativa: ", "")}).`,
    ].join("\n");
    const html = moldura(
      "O seu robô ainda está esperando",
      par(`${esc(ola)} O robô do <strong>${esc(negocio)}</strong> ainda não tem as informações para atender os seus clientes.`) +
        par("Um atalho: <strong>mande um áudio de 2 minutos</strong> no nosso WhatsApp com serviços, preços e horários, e a nossa equipe preenche tudo para você.") +
        botao(whats, "Mandar o áudio no WhatsApp") +
        par(`Se preferir fazer sozinho, <a href="${link}" style="color:#6d5be0;font-weight:700">é por aqui</a>.`) +
        nota(`Cada mês sem o robô pode ser cerca de ${esc(real(total))} que fica na mesa. ${esc(conta)}`),
    );
    return { assunto, html, texto };
  }

  const assunto = `${primeiro ? primeiro + ", s" : "S"}eus clientes já podem estar sendo atendidos pela ivva`;
  const texto = [
    ola,
    ``,
    `A sua assinatura da ivva está ativa, mas o robô do ${negocio} ainda não atende ninguém porque falta preencher as informações do negócio.`,
    `A gente faz isso com você em 15 minutos, pelo WhatsApp (11) 92740-9320 ou por chamada. É só responder este e-mail com o melhor horário.`,
    ``,
    `Para começar sozinho: ${link}`,
  ].join("\n");
  const html = moldura(
    "Vamos colocar o seu robô para trabalhar?",
    par(`${esc(ola)} A sua assinatura da ivva está ativa, mas o robô do <strong>${esc(negocio)}</strong> ainda não atende ninguém porque falta preencher as informações do negócio.`) +
      par("A gente faz isso com você em 15 minutos, pelo WhatsApp ou por chamada. É só responder este e-mail com o melhor horário.") +
      botao(whats, "Preencher com a equipe ivva") +
      nota(`Prefere começar sozinho? <a href="${link}" style="color:#6d5be0">Abra a Base de conhecimento</a>. Cerca de ${esc(real(total))} por mês podem estar ficando na mesa (${esc(conta.replace("Estimativa: ", "estimativa: "))}).`),
  );
  return { assunto, html, texto };
}

/** Resumo do que a ivva fez nos últimos 30 dias, usado nos e-mails do Rescue ligados à assinatura. */
type ResumoUso = { conversas_30d: number; agendamentos_30d: number; preenchido: boolean };
function linhaResumo(r: ResumoUso): string | null {
  if (r.conversas_30d <= 0 && r.agendamentos_30d <= 0) return null;
  const partes = [`${r.conversas_30d} conversa${r.conversas_30d === 1 ? "" : "s"} atendida${r.conversas_30d === 1 ? "" : "s"}`];
  if (r.agendamentos_30d > 0) partes.push(`${r.agendamentos_30d} agendamento${r.agendamentos_30d === 1 ? "" : "s"}`);
  return `Nos últimos 30 dias, a ivva fez ${partes.join(" e ")} pelo seu negócio.`;
}
const primeiroNome = (nome: string | null) => (nome ?? "").trim().split(/\s+/)[0] || "";

/** Rescue: o cliente agendou o cancelamento no portal. Mostra o que perde e a oferta de 30% por 2 meses. */
export function emailCancelamentoAgendado(params: { nome: string | null; negocio: string | null; fim: string | null } & ResumoUso) {
  const link = "https://app.ivva.app.br/assinatura";
  const pn = primeiroNome(params.nome);
  const ola = pn ? `Olá, ${pn}.` : "Olá.";
  const negocio = params.negocio || "o seu negócio";
  const quando = params.fim ? `em ${params.fim}` : "no fim do período pago";
  const resumo = linhaResumo(params);
  const assunto = "Antes de você ir: 30% nas 2 próximas mensalidades";
  const texto = [
    ola,
    ``,
    `Recebemos o cancelamento da assinatura de ${negocio}. Ela continua funcionando ${quando}.`,
    ...(resumo ? [resumo] : []),
    ``,
    `Se quiser continuar, deixamos uma oferta: 30% de desconto nas 2 próximas mensalidades. É só abrir Minha assinatura e clicar em "Quero ficar":`,
    link,
    ``,
    `Se algo não funcionou como esperava, responda este e-mail ou chame no WhatsApp (11) 92740-9320. A gente quer saber e resolver.`,
  ].join("\n");
  const html = moldura(
    "Antes de você ir",
    par(`${esc(ola)} Recebemos o cancelamento da assinatura de <strong>${esc(negocio)}</strong>. Ela continua funcionando ${esc(quando)}.`) +
      (resumo ? par(esc(resumo)) : "") +
      par("Se quiser continuar, deixamos uma oferta: <strong>30% de desconto nas 2 próximas mensalidades</strong>. O robô, a base de conhecimento e o histórico ficam como estão.") +
      botao(link, "Quero ficar com 30%") +
      nota("Se algo não funcionou como esperava, responda este e-mail ou chame no WhatsApp (11) 92740-9320. A gente quer saber e resolver.") +
      nota("Se não fizer nada, o cancelamento acontece na data marcada, sem multa."),
  );
  return { assunto, html, texto };
}

/** Rescue: a cobrança no cartão falhou. Link direto para trocar o cartão (a Stripe tenta de novo sozinha). */
export function emailPagamentoFalhou(params: { nome: string | null; negocio: string | null }) {
  const link = "https://app.ivva.app.br/assinatura/gerenciar?acao=cartao";
  const pn = primeiroNome(params.nome);
  const ola = pn ? `Olá, ${pn}!` : "Olá!";
  const negocio = params.negocio || "o seu negócio";
  const assunto = "Não conseguimos cobrar a mensalidade da ivva";
  const texto = [
    ola,
    ``,
    `A cobrança da mensalidade de ${negocio} não passou no cartão. Acontece: cartão vencido, limite ou bloqueio do banco.`,
    `Para o robô continuar atendendo sem interrupção, atualize o cartão (leva 1 minuto):`,
    link,
    ``,
    `A gente tenta cobrar de novo nos próximos dias. Dúvidas? WhatsApp (11) 92740-9320.`,
  ].join("\n");
  const html = moldura(
    "A mensalidade não passou no cartão",
    par(`${esc(ola)} A cobrança da mensalidade de <strong>${esc(negocio)}</strong> não passou no cartão. Acontece: cartão vencido, limite ou bloqueio do banco.`) +
      par("Para o robô continuar atendendo sem interrupção, atualize o cartão. Leva 1 minuto.") +
      botao(link, "Atualizar o cartão") +
      nota("A gente tenta cobrar de novo nos próximos dias. Dúvidas? WhatsApp (11) 92740-9320. A ivva nunca pede dados de cartão por e-mail ou WhatsApp."),
  );
  return { assunto, html, texto };
}

/** Rescue: o teste grátis acaba em 3 dias (aviso da Stripe). Mostra o resultado ou oferece ajuda para configurar. */
export function emailTesteAcabando(params: { nome: string | null; negocio: string | null; fim: string | null; plano: string | null } & ResumoUso) {
  const pn = primeiroNome(params.nome);
  const ola = pn ? `Olá, ${pn}!` : "Olá!";
  const negocio = params.negocio || "o seu negócio";
  const quando = params.fim ?? "em 3 dias";
  const plano = params.plano ? NOMES_PLANO[params.plano] ?? params.plano : "escolhido";
  const resumo = linhaResumo(params);
  const assunto = `O teste grátis de ${negocio} termina ${params.fim ? "em " + params.fim : "em 3 dias"}`;
  const linkAssinatura = "https://app.ivva.app.br/assinatura";
  const whats = "https://wa.me/5511927409320";

  const meio = params.preenchido
    ? resumo ?? "O robô já tem as informações do seu negócio e está pronto para atender."
    : "O robô ainda não tem as informações do seu negócio. Ainda dá tempo: mande um áudio no WhatsApp com serviços, preços e horários e a nossa equipe preenche para você.";
  const texto = [
    ola,
    ``,
    `O teste grátis de ${negocio} termina ${params.fim ? "em " + quando : quando}. Depois disso, a primeira mensalidade do plano ${plano} é cobrada no cartão cadastrado.`,
    meio,
    ``,
    `Trocar de plano ou cancelar, sem multa: ${linkAssinatura}`,
    `Dúvidas? WhatsApp (11) 92740-9320.`,
  ].join("\n");
  const html = moldura(
    "Seu teste grátis está acabando",
    par(`${esc(ola)} O teste grátis de <strong>${esc(negocio)}</strong> termina ${esc(params.fim ? "em " + quando : quando)}. Depois disso, a primeira mensalidade do plano ${esc(plano)} é cobrada no cartão cadastrado.`) +
      par(esc(meio)) +
      (params.preenchido ? botao(linkAssinatura, "Ver minha assinatura") : botao(whats, "Preencher com a equipe ivva")) +
      nota(`Trocar de plano ou cancelar, sem multa, em <a href="${linkAssinatura}" style="color:#6d5be0">Minha assinatura</a>. Dúvidas? WhatsApp (11) 92740-9320.`),
  );
  return { assunto, html, texto };
}

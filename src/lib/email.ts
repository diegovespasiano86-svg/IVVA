// E-mails transacionais do app (hoje: convite de profissional). Usa a API do Resend com o
// domínio ivva.app.br já verificado. Precisa da variável RESEND_API_KEY (segredo, só na Vercel).
// Sem a chave, nada é enviado e quem chama mostra o link do convite para copiar.
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

/** Convite para o profissional criar a própria senha e acessar o sistema (perfil de usuário, não administrador). */
export function emailConviteProfissional(params: { nome: string; negocio: string; link: string }) {
  const nome = esc(params.nome);
  const negocio = esc(params.negocio);
  const link = esc(params.link);

  const assunto = `Você foi convidado(a) para a equipe de ${params.negocio} na ivva`;

  const texto = [
    `Olá, ${params.nome}!`,
    ``,
    `${params.negocio} convidou você para acessar a ivva, o sistema de atendimento e agenda da equipe.`,
    `Para criar sua senha e entrar, abra o link abaixo (vale por 7 dias):`,
    params.link,
    ``,
    `Seu acesso é de profissional: você vê a sua agenda e as conversas dos clientes. As configurações do negócio ficam com o dono.`,
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
<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#6b6577">O convite vale por 7 dias. Seu acesso é de profissional: você vê a sua agenda e as conversas dos clientes. As configurações do negócio ficam com o dono.</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8496">Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all">${link}</span></p>
<p style="margin:20px 0 0;font-size:12px;color:#8a8496">Não esperava este convite? É só ignorar este e-mail.</p>
</td></tr></table></td></tr></table></body></html>`;

  return { assunto, html, texto };
}

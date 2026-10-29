// Base de conhecimento da Vi ("Pergunte a Ivva"). Tudo que ela sabe vem daqui: navegação do menu,
// guias de cada tela, transcrição dos vídeos, planos e limites, perguntas frequentes, problemas comuns e suporte.
// Regra de ouro: só entra fato que existe no sistema. Mudou uma tela, um plano ou um vídeo? Atualize aqui também
// (os guias vêm de guias.ts e os menus de nav.ts, que já são a fonte única; os vídeos vêm de content/vi-videos.json).
import { GUIAS, type Guia } from "@/lib/guias";
import { NAV_GROUPS } from "@/lib/nav";
import { CONVERSAS_POR_PLANO, PACOTE_AVULSO, POLITICA_CANCELAMENTO, PRECO_MENSAL, RESPOSTAS_POR_CONVERSA_MAX } from "@/lib/planos";
import { SUPORTE_HORARIO, SUPORTE_WHATSAPP_LABEL, URGENCIAS } from "@/lib/suporte";
import videos from "@/content/vi-videos.json";

const TRANSCRICOES = videos as Record<string, string>;

function navegacao(ehDono: boolean): string {
  const papel = ehDono ? "dono" : "profissional";
  return NAV_GROUPS.map((g) => {
    const itens = g.items.filter((i) => i.roles.includes(papel));
    if (!itens.length) return null;
    return `- ${g.label}: ${itens.map((i) => `${i.label} (${i.href})`).join("; ")}`;
  })
    .filter(Boolean)
    .join("\n");
}

function guia(g: Guia): string {
  const video = g.video ? `\nVídeo: use o link [▶ Assistir: ${g.titulo}](/ajuda?abrir=${g.id})` : "\nVídeo: ainda não existe para esta tela.";
  const fala = TRANSCRICOES[g.id] ? `\nO que o vídeo explica (transcrição): ${TRANSCRICOES[g.id]}` : "";
  return `## ${g.titulo} (tela: ${g.href})\n${g.resumo}\nPassos:\n${g.passos.map((p, i) => `${i + 1}. ${p}`).join("\n")}${video}${fala}`;
}

const PLANOS = `# PLANOS E LIMITES
- Essencial R$ ${PRECO_MENSAL.essencial}/mês: ${CONVERSAS_POR_PLANO.essencial} conversas com a IA por mês, 1 calendário.
- Profissional R$ ${PRECO_MENSAL.profissional}/mês: ${CONVERSAS_POR_PLANO.profissional} conversas por mês. Libera SAC, avaliações, comissões, lista de espera, reengajamento, áudio e controle de estoque.
- Completo R$ ${PRECO_MENSAL.completo}/mês: ${CONVERSAS_POR_PLANO.completo} conversas por mês. Libera também comandos do dono, Pix de sinal e recibo.
- Teste grátis de 14 dias no cartão, sem fidelidade. Na Black Friday (20 a 30/11) o teste grátis no cartão é de 30 dias.
- Uma conversa = todas as respostas da IA para o mesmo cliente dentro de 24 horas. O mês renova no dia 1º. Cada conversa vai até ${RESPOSTAS_POR_CONVERSA_MAX} respostas; passou disso, vai para a equipe.
- Avisos de uso em 80%, 90% e 100%. Pacote avulso: ${PACOTE_AVULSO.conversas} conversas por R$ 59, não expira e é usado depois das do plano. Sem conversas, a IA para e as mensagens passam para a equipe.
- Cancelamento: ${POLITICA_CANCELAMENTO}
- Plano anual: congelar pelo e-mail contato@ivva.app.br; sem reembolso do anual. Estorno só em arrependimento (7 dias da 1ª contratação) ou cobrança por erro.
- Pagou no Pix: a cobrança chega por e-mail antes do vencimento e também aparece em Minha assinatura. Sem pagar, o acesso é suspenso 5 dias após o vencimento, sem apagar nada, e volta assim que o pagamento cair.`;

const FAQ = `# PERGUNTAS FREQUENTES
- Ver plano, faturas, trocar cartão ou plano: [Minha assinatura](/assinatura).
- Contrato aceito e data do aceite: [Políticas e privacidade](/politicas), no menu do nome.
- A IA pode errar? Pode. Ela responde com base na Base de conhecimento, no Catálogo e nas regras do Robô. Manter preços e políticas atualizados e acompanhar em Conversas.
- Passar um cliente para a equipe: em Conversas, abrir a conversa e assumir o atendimento. O robô também passa sozinho quando o cliente pede uma pessoa ou o assunto está nas regras de passagem do Robô.
- Segurança: cada negócio só vê os próprios dados, a conexão é criptografada, os acessos ficam registrados e os dados não são vendidos nem usados para treinar IA de terceiros. Dados pessoais: contato@ivva.app.br.`;

const PROBLEMAS = `# PROBLEMAS COMUNS E O QUE FAZER (só estes; fora daqui, encaminhe para a equipe)
- WhatsApp não conecta: a conexão oficial depende da aprovação da Meta, dona do WhatsApp. Enquanto isso dá para deixar tudo configurado e testar o robô no [Simulador](/robo/simulador). Tela: [WhatsApp e canais](/canais). Se a conexão cair depois de conectada, o sistema avisa no topo da tela e a pessoa reconecta em Canais.
- Robô não responde. Causas possíveis: WhatsApp desconectado (aviso no topo da tela); robô pausado (o topo mostra "Robô pausado"); conversas do plano acabaram (avisos em Minha assinatura; dá para comprar o pacote avulso); a conversa passou do limite de respostas em 24 horas e foi para a equipe; alguém da equipe assumiu aquela conversa em [Conversas](/conversas).
- Robô respondeu errado: abrir [Calibrar robô](/robo), conversar como cliente, clicar no polegar para baixo na resposta errada e escrever a resposta certa. Também corrigir ou completar a [Base de conhecimento](/base-conhecimento) (preços, horários, regras).
- Google Agenda: em [Integrações e API](/integracoes), clicar em Conectar Google Agenda. Na tela do Google, MARCAR a caixa de acesso à agenda e clicar em Continuar. Se aparecer "não verificado", clicar em Avançado e depois em Acessar ivva. Conectou mas nada chega na agenda ou aparece erro vermelho no card: clicar em Desconectar, conectar de novo marcando a caixa da agenda, e usar Sincronizar agora. O card mostra o motivo quando o Google recusa. Enquanto o app estiver em fase de teste no Google, só entram e-mails que a ivva liberou; se o Google bloquear, falar com a equipe.
- "Enviar o convite ao cliente" (Google Agenda): só funciona quando o cliente tem e-mail cadastrado. Ligar e desligar pelo botão do card.
- Cobrar pelo Asaas: em [Integrações e API](/integracoes), colar a chave de API do Asaas (começa com $aact_; no Asaas: Integrações, Chaves de API, Gerar) e clicar em Conectar Asaas. Para cobrar por Pix é preciso cadastrar uma chave Pix no Asaas (Pix, Minhas chaves). Depois aparece o botão Cobrar pelo Asaas no [Checkout](/checkout).
- Cobrar pelo Mercado Pago: em Integrações e API, clicar em Conectar Mercado Pago, entrar na conta e tocar em Autorizar (não precisa copiar chave). Quem tem maquininha Point clica em Buscar minhas maquininhas.
- Stone, Cielo, Rede, Getnet, PagBank: ainda não há conexão automática. Passe o cartão normalmente e registre no Checkout, escolhendo Crédito ou Débito e Registrar pagamento. Estoque, comissão e relatórios atualizam na hora. A conexão automática está em desenvolvimento.
- "Paga, baixa falhou" em Conferência das cobranças: o dinheiro entrou, mas falta registrar a venda (por exemplo, sem estoque). Registrar a venda manualmente no Checkout.
- Entrar na equipe: o dono convida por e-mail em [Conta e equipe](/conta); a pessoa recebe o e-mail e cria a própria senha. Usuário atende e consulta; Administrador também configura. O dono que também atende usa "Eu também atendo".
- Importar clientes, catálogo ou vendas antigas: cada tela tem um modelo de planilha para baixar. Vendas antigas só aceitam meses anteriores ao atual, não duplicam e dá para desfazer o lote.
- Acesso suspenso por falta de pagamento: pagar em [Minha assinatura](/assinatura); o acesso volta quando o pagamento cair e nada é apagado.
- Recurso bloqueado ("disponível em outro plano"): vários recursos dependem do plano (veja PLANOS E LIMITES). Trocar de plano em Minha assinatura.`;

const SUPORTE = `# SUPORTE HUMANO (nível 2)
- WhatsApp (equipe ivva): ${SUPORTE_WHATSAPP_LABEL}, em ${SUPORTE_HORARIO}. E-mail: contato@ivva.app.br.
- O link [Falar com a equipe](/ajuda#suporte) abre o WhatsApp já com negócio, plano e tela preenchidos.
- Prazos da primeira resposta: ${URGENCIAS.map((u) => `${u.nome.toLowerCase()} (${u.quando.toLowerCase()}): ${u.prazo}`).join("; ")}.`;

/** Manual completo da Vi para o perfil de quem pergunta (dono vê tudo; profissional só as telas dele). */
export function manualDaVi(ehDono: boolean): string {
  const guias = GUIAS.filter((g) => ehDono || !g.soDono);
  return [`# MENU DO SISTEMA (onde fica cada coisa)\n${navegacao(ehDono)}`, `# GUIAS E VÍDEOS POR TELA\n${guias.map(guia).join("\n\n")}`, PLANOS, FAQ, PROBLEMAS, SUPORTE].join("\n\n");
}

/** IDs de guias que têm vídeo, para conferir os links que a Vi sugere. */
export const IDS_COM_VIDEO = new Set(GUIAS.filter((g) => g.video).map((g) => g.id));

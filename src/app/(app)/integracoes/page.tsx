import PageHeader from "@/components/page-header";
import { Plug } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { origemDoApp } from "@/lib/origem";
import NovaChave from "./nova-chave";
import GoogleAgendaCard from "./google-agenda-card";
import ConectarAsaas from "./conectar-asaas";
import ConectarMercadoPago from "./conectar-mercadopago";
import { mpDisponivel } from "@/lib/mercadopago";
import { revogarChave } from "./actions";

type Chave = { id: string; nome: string; prefixo: string; criada_em: string; ultimo_uso: string | null };

type Cobranca = { id: string; criada_em: string; provedor: string | null; forma: string; valor: number; status: string };
const STATUS: Record<string, string> = { pendente: "Aguardando", paga: "Paga e registrada", paga_sem_registro: "Paga, baixa falhou", expirada: "Expirada", cancelada: "Cancelada" };
const MENSAGEM_MP: Record<string, { ok: boolean; texto: string }> = {
  ok: { ok: true, texto: "Mercado Pago conectado! Agora é só cobrar pelo Checkout." },
  erro: { ok: false, texto: "Não consegui conectar o Mercado Pago. Tente de novo; se repetir, fale com o suporte." },
  so_dono: { ok: false, texto: "Só o administrador pode conectar o Mercado Pago." },
  indisponivel: { ok: false, texto: "A conexão com o Mercado Pago ainda não está liberada nesta conta." },
};

export default async function IntegracoesPage({ searchParams }: { searchParams: Promise<{ mp?: string; google?: string; sync?: string }> }) {
  const { mp, google, sync } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("api_chave_listar");
  const chaves = (data ?? []) as Chave[];
  const { data: asaasData } = await supabase.rpc("asaas_conta_estado");
  const asaasEstado = asaasData as { conectada: boolean; ambiente?: string } | null;
  const { data: mpData } = await supabase.rpc("mp_conta_estado");
  const mpEstado = mpData as { conectada?: boolean; terminal_id?: string | null } | null;
  const { data: cobrData } = await supabase.from("cobrancas").select("id, criada_em, provedor, forma, valor, status").order("criada_em", { ascending: false }).limit(12);
  const cobrancas = (cobrData ?? []) as Cobranca[];
  const avisoMP = mp ? MENSAGEM_MP[mp] : null;
  const origem = await origemDoApp();
  const quando = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <PageHeader icon={Plug} title="Integrações e API" subtitle="Mande contatos de formulários, anúncios e planilhas direto para o seu CRM, pelo Zapier, n8n ou outra ferramenta." />

      <GoogleAgendaCard aviso={sync === "erro" ? "erro_sync" : (sync ?? google)} />

      <div className="mb-2 mt-1">
        <p className="text-[16px] font-bold">Conecte sua conta e receba pagamentos</p>
        <p className="mt-1 text-[12.5px] text-ink-soft">
          O dinheiro cai direto na SUA conta; a ivva só recebe o aviso de que pagou e dá baixa no estoque, na comissão e nos relatórios. Escolha uma opção (ou use as duas).
        </p>
      </div>
      {avisoMP && (
        <p role="status" className={`mb-3 rounded-[12px] px-4 py-3 text-[13px] font-semibold ${avisoMP.ok ? "bg-teal/10 text-teal" : "bg-coral/10 text-coral"}`}>{avisoMP.texto}</p>
      )}

      <div className="card mb-4 px-5 py-5">
        <p className="text-[14px] font-bold">1. Asaas <span className="font-normal text-ink-soft">· Pix e cartão por link ou QR Code</span> {asaasEstado?.conectada && <b className="ml-1 text-[12px] text-teal">Conectado</b>}</p>
        <details className="my-2 text-[12.5px] text-ink-soft" open={!asaasEstado?.conectada}>
          <summary className="cursor-pointer font-bold text-purple">Como conectar, passo a passo</summary>
          <ol className="ml-5 mt-2 list-decimal space-y-1">
            <li>Não tem conta? <a href="https://www.asaas.com" target="_blank" rel="noreferrer" className="font-bold text-purple underline">Crie a sua grátis no Asaas</a> e envie os documentos pedidos (a análise leva de minutos a alguns dias).</li>
            <li>Com a conta aprovada, abra o Asaas e vá em <b>Integrações &gt; Chaves de API &gt; Gerar</b>. Copie a chave (começa com <code>$aact_</code>).</li>
            <li>Cole a chave aqui embaixo e clique em <b>Conectar Asaas</b>. Pronto: o botão &ldquo;Cobrar pelo Asaas&rdquo; aparece no Checkout.</li>
            <li>No Asaas, cadastre uma chave Pix em <b>Pix &gt; Minhas chaves</b> (necessário para cobrar por Pix).</li>
          </ol>
        </details>
        <ConectarAsaas conectada={!!asaasEstado?.conectada} ambiente={asaasEstado?.ambiente ?? null} />
      </div>

      <div className="card mb-4 px-5 py-5">
        <p className="text-[14px] font-bold">2. Mercado Pago <span className="font-normal text-ink-soft">· Pix, link e maquininha Point</span> {mpEstado?.conectada && <b className="ml-1 text-[12px] text-teal">Conectado</b>}</p>
        {mpDisponivel() ? (
          <>
            <details className="my-2 text-[12.5px] text-ink-soft" open={!mpEstado?.conectada}>
              <summary className="cursor-pointer font-bold text-purple">Como conectar, passo a passo</summary>
              <ol className="ml-5 mt-2 list-decimal space-y-1">
                <li>Não tem conta? <a href="https://www.mercadopago.com.br" target="_blank" rel="noreferrer" className="font-bold text-purple underline">Crie a sua grátis no Mercado Pago</a>.</li>
                <li>Clique em <b>Conectar Mercado Pago</b>, entre na sua conta e toque em <b>Autorizar</b>. É só isso, não precisa copiar chave.</li>
                <li>Tem maquininha Point? Depois de conectar, clique em <b>Buscar minhas maquininhas</b> e escolha a sua. As cobranças vão direto para ela.</li>
              </ol>
            </details>
            <ConectarMercadoPago conectada={!!mpEstado?.conectada} terminalId={mpEstado?.terminal_id ?? null} />
          </>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink-soft">Em breve: conexão com um clique, sem copiar chave.</p>
        )}
      </div>

      <div className="card mb-4 px-5 py-5">
        <p className="text-[14px] font-bold">3. Outras maquininhas <span className="font-normal text-ink-soft">· Stone, Cielo, Rede, Getnet, PagBank e outras</span></p>
        <ol className="ml-5 mt-2 list-decimal space-y-1 text-[12.5px] text-ink-soft">
          <li>Passe o cartão na sua maquininha normalmente.</li>
          <li>No <b>Checkout</b>, monte a venda, escolha <b>Crédito</b> ou <b>Débito</b> e clique em <b>Registrar pagamento</b> (5 segundos). Estoque, comissão e relatórios atualizam na hora.</li>
          <li>Conexão automática e conferência com o extrato dessas maquininhas: <b>em desenvolvimento</b>.</li>
        </ol>
      </div>

      <div className="card mb-4 px-5 py-5">
        <p className="text-[14px] font-bold">Conferência das cobranças</p>
        <p className="mb-2 mt-1 text-[12.5px] text-ink-soft">Cada cobrança gerada pelo Checkout, com o que já foi pago e registrado. &ldquo;Paga, baixa falhou&rdquo; significa que o dinheiro entrou mas falta registrar a venda (ex.: sem estoque): registre manualmente no Checkout.</p>
        {cobrancas.length === 0 ? (
          <p className="text-[12.5px] text-ink-faint">Nenhuma cobrança gerada ainda.</p>
        ) : (
          <ul className="divide-y divide-border text-[13px]">
            {cobrancas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{quando(c.criada_em)} · {c.provedor === "mercadopago" ? "Mercado Pago" : "Asaas"} · {c.forma === "maquininha" ? "maquininha" : c.forma === "link" ? "link" : "Pix"}</span>
                <span><b>{Number(c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b> · <span className={c.status === "paga" ? "font-bold text-teal" : c.status === "paga_sem_registro" ? "font-bold text-coral" : "text-ink-soft"}>{STATUS[c.status] ?? c.status}</span></span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card mb-4 px-5 py-5">
        <p className="text-[14px] font-bold">Chaves de acesso</p>
        <p className="mb-3 mt-1 text-[12.5px] text-ink-soft">Quem tem a chave pode criar contatos no seu CRM. Trate como senha e revogue se vazar.</p>
        <NovaChave />
        {chaves.length > 0 && (
          <ul className="mt-4 divide-y divide-border">
            {chaves.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
                <span><b>{c.nome}</b> · <code>{c.prefixo}…</code> · criada em {quando(c.criada_em)} · {c.ultimo_uso ? `último uso ${quando(c.ultimo_uso)}` : "nunca usada"}</span>
                <form action={revogarChave}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-[12px] font-bold text-coral">Revogar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card px-5 py-5">
        <p className="text-[14px] font-bold">Como usar</p>
        <p className="mb-2 mt-1 text-[12.5px] text-ink-soft">No Zapier, use a ação &ldquo;Webhooks by Zapier &gt; POST&rdquo;; no n8n, o nó &ldquo;HTTP Request&rdquo;. Dados em JSON:</p>
        <pre className="overflow-x-auto rounded-xl bg-surface-soft p-3 text-[12px] leading-relaxed">{`POST ${origem}/api/v1/contatos
Authorization: Bearer SUA_CHAVE
Content-Type: application/json

{ "nome": "Maria Souza", "telefone": "(11) 99999-9999", "email": "maria@email.com" }`}</pre>
        <p className="mt-2 text-[12.5px] text-ink-soft">
          Resposta 201 = contato criado; 200 = o telefone já existia no CRM (nada duplicado); 401 = chave inválida; 422 = nome ou telefone com DDD faltando.
          Disparos de saída (avisar outra ferramenta quando um agendamento for criado) ainda não existem nesta versão.
        </p>
      </div>
    </div>
  );
}

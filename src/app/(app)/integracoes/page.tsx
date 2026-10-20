import PageHeader from "@/components/page-header";
import { Plug } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { origemDoApp } from "@/lib/origem";
import NovaChave from "./nova-chave";
import { revogarChave } from "./actions";

type Chave = { id: string; nome: string; prefixo: string; criada_em: string; ultimo_uso: string | null };

export default async function IntegracoesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("api_chave_listar");
  const chaves = (data ?? []) as Chave[];
  const origem = await origemDoApp();
  const quando = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <PageHeader icon={Plug} title="Integrações e API" subtitle="Mande contatos de formulários, anúncios e planilhas direto para o seu CRM, pelo Zapier, n8n ou outra ferramenta." />

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

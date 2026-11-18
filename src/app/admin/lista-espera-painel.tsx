import type { SupabaseClient } from "@supabase/supabase-js";
import BaixarLista, { type LinhaLista } from "./baixar-lista";

type Linha = {
  nome: string | null;
  email: string;
  telefone: string | null;
  segmento: string | null;
  origem: Record<string, string> | null;
  created_at: string;
};

function linkWhatsapp(telefone: string | null, nome: string | null) {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  const numero = d.startsWith("55") ? d : `55${d}`;
  const primeiro = (nome ?? "").trim().split(/\s+/)[0] || "";
  const texto = `Oi${primeiro ? `, ${primeiro}` : ""}! Aqui é da ivva. Você entrou na lista dos 60 dias grátis e a gente quer marcar um bate-papo rápido para liberar o seu acesso. Qual o melhor horário para você?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Lista de espera dos 60 dias grátis: quem se cadastrou, na ordem, com WhatsApp pronto e download para o Excel. */
export default async function ListaEsperaPainel({ supabase }: { supabase: SupabaseClient }) {
  const { data, error } = await supabase
    .from("lista_vip")
    .select("nome, email, telefone, segmento, origem, created_at")
    .eq("campanha", "lista-60-dias")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) return null;
  const linhas = (data ?? []) as Linha[];
  const dados: LinhaLista[] = linhas.map((l, i) => ({
    n: i + 1,
    data: new Date(l.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    nome: l.nome ?? "",
    whatsapp: l.telefone ?? "",
    email: l.email,
    negocio: l.segmento ?? "",
    origem: l.origem?.utm_content || l.origem?.utm_source || l.origem?.referrer || "",
  }));

  return (
    <div className="mb-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-bold">
          Lista de espera dos 60 dias <span className="font-normal text-ink-faint">({linhas.length} inscrito{linhas.length === 1 ? "" : "s"}, em ordem de cadastro)</span>
        </p>
        <BaixarLista linhas={dados} />
      </div>
      {linhas.length === 0 ? (
        <p className="card px-4 py-3 text-[13px] text-ink-soft">Ainda não há inscritos. Quando alguém entrar pela página /60-dias do site, aparece aqui.</p>
      ) : (
        <div className="card divide-y divide-border">
          {linhas.slice(0, 60).map((l, i) => {
            const zap = linkWhatsapp(l.telefone, l.nome);
            return (
              <div key={`${l.email}-${i}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <p className="font-semibold">
                    <span className="text-ink-faint">{i + 1}.</span> {l.nome ?? "Sem nome"} <span className="font-normal text-ink-faint">· {l.segmento ?? "negócio não informado"}</span>
                  </p>
                  <p className="text-[12px] text-ink-faint">
                    {l.telefone ?? "sem WhatsApp"} · {l.email} · {new Date(l.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                </div>
                {zap && (
                  <a href={zap} target="_blank" rel="noreferrer" className="shrink-0 text-[12px] font-bold text-teal hover:underline">
                    Chamar no WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

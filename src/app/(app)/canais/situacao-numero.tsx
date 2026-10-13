"use client";

import { useState } from "react";
import { Check } from "lucide-react";

type Situacao = {
  id: string;
  titulo: string;
  dica: string;
  resumo: string;
  passos: string[];
  avisos?: string[];
};

const SITUACOES: Situacao[] = [
  {
    id: "novo",
    titulo: "Número novo",
    dica: "Um chip ou fixo que nunca teve WhatsApp",
    resumo: "É o caminho mais simples: o número entra direto na ivva.",
    passos: [
      "Deixe o chip num aparelho ligado, ou o telefone fixo por perto: a Meta manda um código por SMS ou ligação.",
      "Clique em “Conectar WhatsApp” e siga a janela da Meta.",
      "Informe o número, receba o código e confirme.",
    ],
  },
  {
    id: "business",
    titulo: "Já uso o WhatsApp Business",
    dica: "O aplicativo verde com o “B”, no celular",
    resumo: "Você continua usando o aplicativo no celular e a ivva atende junto, no mesmo número.",
    passos: [
      "Atualize o aplicativo WhatsApp Business no celular.",
      "Clique em “Conectar WhatsApp” e escolha a opção de conectar o aplicativo que você já usa.",
      "Abra o aplicativo e leia o código que a janela da Meta mostrar.",
    ],
    avisos: [
      "Entram na ivva as conversas dos últimos 30 dias. As mais antigas ficam só no celular.",
      "Grupos e ligações não aparecem na ivva.",
      "Listas de transmissão ficam só para leitura.",
      "Mensagens temporárias e de visualização única são desligadas.",
      "Conta do aplicativo criada há poucos dias pode ser recusada pela Meta. Use o número por um tempo e tente de novo.",
    ],
  },
  {
    id: "pessoal",
    titulo: "Uso o WhatsApp comum",
    dica: "O aplicativo de uso pessoal",
    resumo: "A Meta não deixa o mesmo número ficar no WhatsApp comum e no sistema ao mesmo tempo.",
    passos: [
      "Faça o backup das conversas no celular (Configurações → Conversas → Backup).",
      "Mais simples: instale o WhatsApp Business, passe o número para ele e, depois de alguns dias de uso, siga o caminho “Já uso o WhatsApp Business”.",
      "Ou: apague a conta no aplicativo (Configurações → Conta → Apagar conta) e conecte como número novo.",
    ],
    avisos: ["Apagar a conta remove o histórico e os grupos daquele número. Faça o backup antes."],
  },
  {
    id: "outro",
    titulo: "Está em outro sistema",
    dica: "Outro fornecedor de atendimento",
    resumo: "O número precisa sair do outro sistema antes de entrar na ivva.",
    passos: [
      "Desligue o número no sistema atual.",
      "No Gerenciador do WhatsApp (business.facebook.com), em Parceiros, remova o fornecedor antigo.",
      "Volte aqui e conecte como número novo.",
    ],
    avisos: ["Modelos de mensagem, robôs e histórico do outro sistema não vêm junto. Os modelos precisam ser criados de novo, em Campanhas."],
  },
];

const ANTES = [
  "Um perfil do Facebook que seja administrador da empresa (ou crie a empresa na própria janela da Meta).",
  "O número do negócio à mão, capaz de receber SMS ou ligação.",
  "Um cartão para cadastrar na Meta: ela cobra direto de você as mensagens de divulgação. Responder cliente em até 24 horas não tem custo da Meta.",
  "O nome que vai aparecer para o cliente igual ao nome do seu negócio (a Meta confere).",
];

/** Ajuda o dono a escolher o caminho certo antes de abrir a janela da Meta. */
export default function SituacaoNumero() {
  const [aberta, setAberta] = useState<string | null>(null);
  const s = SITUACOES.find((x) => x.id === aberta);

  return (
    <div className="mb-6">
      <h3 className="text-[14px] font-extrabold">Qual é a situação do seu número hoje?</h3>
      <p className="mb-3 text-[12.5px] text-ink-soft">Escolha uma opção para ver o caminho certo e o que muda.</p>
      <div role="radiogroup" aria-label="Situação do número" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SITUACOES.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={aberta === o.id}
            onClick={() => setAberta(aberta === o.id ? null : o.id)}
            className={`rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 ${aberta === o.id ? "border-purple bg-[#f6f4fe] shadow-[0_0_0_1px_var(--purple)]" : "border-border bg-surface hover:border-purple/50"}`}
          >
            <p className="text-[13.5px] font-extrabold leading-tight">{o.titulo}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">{o.dica}</p>
          </button>
        ))}
      </div>

      {s && (
        <div className="mt-3 rounded-xl border border-border bg-bg px-4 py-3.5">
          <p className="text-[13px] font-bold">{s.resumo}</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[12.5px] leading-snug text-ink-soft">
            {s.passos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          {s.avisos && (
            <div className="mt-3 rounded-lg bg-[#fff6e5] px-3.5 py-2.5">
              <p className="text-[12px] font-extrabold text-amber">Antes de seguir, saiba que:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[12.5px] leading-snug text-ink">
                {s.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 rounded-xl border border-border px-4 py-3.5">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Tenha em mãos</p>
        <ul className="mt-2 space-y-1.5">
          {ANTES.map((a) => (
            <li key={a} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-soft">
              <Check size={14} className="mt-0.5 flex-none text-teal" />
              {a}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

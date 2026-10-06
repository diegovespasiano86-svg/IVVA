import Alert from "@/components/alert";
import ComprarCreditosButton from "@/components/comprar-creditos-button";
import UsoIaModal from "@/components/uso-ia-modal";
import { formatarNumero } from "@/lib/planos";
import { estadoDoUso, type ResumoUso } from "@/lib/uso-ia";

function dataRenovacao(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Aviso de consumo das conversas da IA (só para o dono), em toda tela do app:
 * 80% e 90% = aviso; 100% = alerta forte + janela de compra já pronta;
 * IA parada = alerta vermelho. O botão abre o pagamento do pacote avulso direto.
 */
export default function UsoIaAviso({ resumo }: { resumo: ResumoUso }) {
  const estado = estadoDoUso(resumo);
  if (estado === "ok") return null;

  const usadas = formatarNumero(resumo.usado_plano);
  const limite = formatarNumero(resumo.limite);
  const renova = dataRenovacao(resumo.renova_em);
  const restamFolga = Math.max(resumo.folga_max - resumo.usado_folga, 0);

  if (estado === "aviso80") {
    return (
      <Alert tone="info" actionNode={<ComprarCreditosButton />}>
        Você já usou 80% das conversas da IA deste mês ({usadas} de {limite}). O plano renova em {renova}. Se
        quiser garantir o atendimento até lá, compre créditos avulsos.
      </Alert>
    );
  }

  if (estado === "aviso90") {
    return (
      <Alert tone="warn" actionNode={<ComprarCreditosButton />}>
        Atenção: 90% das conversas da IA deste mês já foram usadas ({usadas} de {limite}). Compre créditos agora
        para a IA não parar de atender seus clientes.
      </Alert>
    );
  }

  if (estado === "usando_avulso") {
    return (
      <Alert tone="info" actionNode={<ComprarCreditosButton />}>
        As conversas do seu plano acabaram. A IA está usando seus créditos avulsos: restam{" "}
        {formatarNumero(resumo.saldo_extra)}. O plano renova em {renova}.
      </Alert>
    );
  }

  if (estado === "esgotado_folga") {
    return (
      <>
        <UsoIaModal estado={estado} restam={restamFolga} renova={renova} />
        <Alert tone="danger" pulse actionNode={<ComprarCreditosButton variant="primary" />}>
          As conversas com a IA deste mês acabaram ({usadas} de {limite}). Ela ainda atende na margem de segurança
          (restam {formatarNumero(restamFolga)}). Compre créditos agora para não parar.
        </Alert>
      </>
    );
  }

  return (
    <>
      <UsoIaModal estado={estado} restam={0} renova={renova} />
      <Alert tone="danger" pulse actionNode={<ComprarCreditosButton variant="primary" />}>
        A IA parou de responder: as conversas deste mês acabaram. Seus clientes estão sendo encaminhados para a sua
        equipe. Compre créditos e ela volta a atender na hora. O plano renova em {renova}.
      </Alert>
    </>
  );
}

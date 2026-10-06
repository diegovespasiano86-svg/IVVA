import { redirect } from "next/navigation";

// As avaliações agora ficam em Relatórios. Este endereço continua valendo para links antigos.
export default function AvaliacoesPage() {
  redirect("/relatorios?aba=avaliacoes");
}

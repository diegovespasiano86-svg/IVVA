import { redirect } from "next/navigation";

// Faturamento e comissões agora ficam em Relatórios. Este endereço continua valendo para links antigos.
export default function FaturamentoPage() {
  redirect("/relatorios?aba=faturamento&periodo=mes");
}

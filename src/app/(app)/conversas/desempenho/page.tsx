import { redirect } from "next/navigation";

// O desempenho do robô agora fica em Relatórios. Este endereço continua valendo para links antigos.
export default function DesempenhoPage() {
  redirect("/relatorios?aba=robo");
}

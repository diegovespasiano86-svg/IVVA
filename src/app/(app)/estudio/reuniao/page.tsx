import { CalendarCheck } from "lucide-react";
import PageHeader from "@/components/page-header";
import ReuniaoForm from "./reuniao-form";

export default function ReuniaoPage() {
  return (
    <div className="mx-auto max-w-[820px]">
      <PageHeader icon={CalendarCheck} title="Falar com a ivva" subtitle="Conversa de 25 minutos para entender seu negócio e propor o projeto certo. Disponível em todos os planos." />
      <ReuniaoForm />
    </div>
  );
}

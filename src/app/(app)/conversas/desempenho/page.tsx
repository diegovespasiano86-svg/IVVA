import ConversasDashboard from "../dashboard";

export default async function DesempenhoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-extrabold">Desempenho do atendimento</h1>
        <p className="text-[13.5px] text-ink-soft">
          Como o robô está atendendo: clientes, assuntos, fechamentos e conversas que precisam de resgate.
        </p>
      </div>
      <ConversasDashboard periodo={periodo === "dia" || periodo === "mes" ? periodo : "semana"} />
    </div>
  );
}

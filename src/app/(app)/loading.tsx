// Aparece na hora ao trocar de tela, enquanto os dados chegam.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="skeleton mb-5 h-[112px] !rounded-[20px]" />
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[92px] !rounded-2xl" />
        ))}
      </div>
      <div className="skeleton mt-4 h-[260px] !rounded-2xl" />
    </div>
  );
}

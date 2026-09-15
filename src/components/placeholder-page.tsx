export default function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="font-display text-[22px] font-extrabold">{title}</h1>
      <p className="mt-1 text-[13.5px] text-ink-soft">{description}</p>

      <div className="card mt-5 flex flex-col items-center gap-2 px-6 py-14 text-center">
        <svg
          className="icon"
          viewBox="0 0 24 24"
          width="26"
          height="26"
          style={{ color: "var(--purple)" }}
        >
          <path d="M12 8v5M12 16h.01M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        </svg>
        <p className="text-[14px] font-bold">Módulo em construção</p>
        <p className="max-w-[360px] text-[13px] text-ink-faint">
          O dashboard e o acesso por perfil já estão no ar. Este módulo entra
          nas próximas semanas, junto com a conexão real do WhatsApp.
        </p>
      </div>
    </div>
  );
}

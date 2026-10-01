// Re-monta a cada troca de tela: dispara a entrada em cascata (.stagger).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="stagger">{children}</div>;
}

// Fundo em degradê nas cores oficiais da ivva (teal/roxo/coral) sobre o
// preto do tema escuro — mesma receita usada na seção de planos do site
// público, sem elementos de hero (sem headline, sem CTAs, sem bolhas).
export function GlowBackdrop({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(640px circle at 0% 0%, rgba(47,191,159,0.26), transparent 65%)",
            "radial-gradient(600px circle at 100% 40%, rgba(139,127,232,0.28), transparent 65%)",
            "radial-gradient(520px circle at 45% 110%, rgba(255,107,91,0.16), transparent 65%)",
          ].join(","),
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(247,246,242,0.07) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)",
        }}
      />
    </div>
  );
}

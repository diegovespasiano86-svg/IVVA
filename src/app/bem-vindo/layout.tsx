import PlanosLayout from "../planos/layout";
import { GlowBackdrop } from "../planos/brand-fx";
import IvvaLogo from "../planos/logo";

// Mesma moldura da tela de planos e do pagamento (fundo escuro, marca, cartão branco),
// para o cliente ver o mesmo visual até entrar no sistema.
export default function BemVindoLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlanosLayout>
      <main className="relative isolate min-h-screen overflow-hidden px-4 py-10">
        <GlowBackdrop />
        <div className="relative mx-auto max-w-[560px]">
          <div className="mb-8">
            <IvvaLogo light />
          </div>
          {children}
        </div>
      </main>
    </PlanosLayout>
  );
}

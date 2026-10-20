import { carregarPassos } from "@/components/primeiros-passos";
import ProximoPassoFlutuante from "@/components/proximo-passo-flutuante";
import type { Termos } from "@/lib/termos";

/** Lê os passos de ativação e entrega o próximo ao botão flutuante. Nada aparece se tudo estiver pronto. */
export default async function ProximoPasso({ termos }: { termos: Termos }) {
  try {
    const passos = await carregarPassos(termos);
    const proximo = passos.find((p) => !p.feito);
    if (!proximo) return null;
    return <ProximoPassoFlutuante titulo={proximo.titulo} href={proximo.href} feitos={passos.filter((p) => p.feito).length} total={passos.length} />;
  } catch {
    return null;
  }
}

import { redirect } from "next/navigation";

// O estoque agora faz parte do Catálogo (serviços, produtos de venda e insumos).
export default function EstoqueRedirect() {
  redirect("/catalogo");
}

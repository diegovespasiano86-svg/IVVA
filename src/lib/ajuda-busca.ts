import { GUIAS, type Guia } from "@/lib/guias";

/** minúsculas e sem acento, para a busca achar "horario" e "horário". */
export function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function guiasDoPerfil(ehDono: boolean): Guia[] {
  return GUIAS.filter((g) => ehDono || !g.soDono);
}

/** Todos os termos digitados precisam aparecer; título pesa mais que palavras-chave, que pesam mais que o texto. */
export function buscarGuias(q: string, lista: Guia[]): Guia[] {
  const termos = norm(q).split(/\s+/).filter(Boolean);
  if (!termos.length) return lista;
  return lista
    .map((g) => {
      const titulo = norm(g.titulo);
      const chaves = norm((g.palavras ?? []).join(" "));
      const texto = norm(`${g.resumo} ${g.passos.join(" ")}`);
      let pontos = 0;
      for (const t of termos) {
        if (titulo.includes(t)) pontos += 3;
        else if (chaves.includes(t)) pontos += 2;
        else if (texto.includes(t)) pontos += 1;
        else return { g, pontos: 0 };
      }
      return { g, pontos };
    })
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((r) => r.g);
}

/** Telas que não são o endereço de nenhuma guia usam o vídeo da guia mais próxima. */
const ROTA_PARA_GUIA: Record<string, string> = { "/clientes": "clientes", "/assinatura": "conta" };
/** Telas que usam a guia de outra rota, mesmo havendo um href mais curto que casa (ex.: /clientes). */
const ROTA_FIXA: Record<string, string> = { "/clientes/listas": "etiquetas-listas" };

/** Guia da tela atual: o href mais específico que casa com a rota (ou a guia indicada em ROTA_PARA_GUIA). */
export function guiaDaRota(pathname: string, lista: Guia[]): Guia | undefined {
  const fixa = Object.keys(ROTA_FIXA).find((r) => pathname === r || pathname.startsWith(r + "/"));
  if (fixa) return lista.find((g) => g.id === ROTA_FIXA[fixa]);
  const exata = lista
    .filter((g) => pathname === g.href || pathname.startsWith(g.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (exata) return exata;
  const rota = Object.keys(ROTA_PARA_GUIA).find((r) => pathname === r || pathname.startsWith(r + "/"));
  return rota ? lista.find((g) => g.id === ROTA_PARA_GUIA[rota]) : undefined;
}

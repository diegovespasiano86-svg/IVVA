import { headers } from "next/headers";

/** Endereço oficial do app: em produção é sempre app.ivva.app.br, para os links e retornos nunca saírem de lá. */
export async function origemDoApp(): Promise<string> {
  if (process.env.VERCEL_ENV === "production") return "https://app.ivva.app.br";
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host") ?? "localhost:3000"}`;
}

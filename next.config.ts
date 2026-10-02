import type { NextConfig } from "next";

// Cabeçalhos de segurança do navegador em todas as rotas.
// - frame-ancestors/X-Frame-Options: ninguém pode embutir o app em outro site (anti-clickjacking).
// - A CSP aqui NÃO restringe scripts: Stripe (checkout embutido) e o SDK da Meta (Embedded Signup)
//   carregam de fora; uma política de scripts exige teste tela a tela antes de ligar.
// - microphone=(self): a base de conhecimento grava áudio no próprio app.
// - COOP same-origin-allow-popups: o login da Meta abre em popup e precisa falar com a página.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;

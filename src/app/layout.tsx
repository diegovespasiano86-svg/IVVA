import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import "./ambient.css";
import "./tema.css";
import "./densidade.css";
import "./vidro.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ivva", template: "%s · ivva" },
  description: "Recepção com IA no WhatsApp para negócios de serviço.",
  applicationName: "ivva",
};

// Aplica as preferências de aparência (cor, densidade e modo claro/escuro) antes da primeira pintura, sem piscar.
// O modo escuro só vale nas telas internas (planos, boas-vindas, login e páginas públicas ficam como são);
// "?tema=escuro" ou "?tema=claro" no endereço também escolhe o modo. Texto fixo, sem dado de usuário.
const PREFS_SCRIPT = `try{var d=document.documentElement,a=localStorage.getItem("ivva:cor"),t=localStorage.getItem("ivva:densidade"),m=localStorage.getItem("ivva:tema"),q=/[?&]tema=(escuro|claro)/.exec(location.search),p=location.pathname;if(q){m=q[1];localStorage.setItem("ivva:tema",m)}if(a&&/^(azul|verde|rosa|laranja|grafite)$/.test(a))d.setAttribute("data-accent",a);if(t==="compact")d.setAttribute("data-density","compact");if(m==="escuro"&&!(p==="/"||/^\\/(login|planos|bem-vindo|esqueci-senha|redefinir-senha|contrato|auth|admin|r\\/|convite\\/(?!preview))/.test(p)))d.setAttribute("data-theme","dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${instrumentSerif.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        {children}
      </body>
    </html>
  );
}

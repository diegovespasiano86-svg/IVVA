import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

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
  title: "IVVA",
  description: "Recepção com IA no WhatsApp para negócios de serviço.",
};

// Aplica as preferências de aparência (cor e densidade) antes da primeira pintura, sem piscar.
// Texto fixo, sem dado de usuário.
const PREFS_SCRIPT = `try{var d=document.documentElement,a=localStorage.getItem("ivva:cor"),t=localStorage.getItem("ivva:densidade");if(a&&/^(azul|verde|rosa|laranja|grafite)$/.test(a))d.setAttribute("data-accent",a);if(t==="compact")d.setAttribute("data-density","compact")}catch(e){}`;

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

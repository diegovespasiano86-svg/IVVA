import { Plus_Jakarta_Sans, Instrument_Serif } from "next/font/google";

// Fontes escopadas só pra /planos — igual ao site público ivva.app.br —
// sem mexer na fonte (Sora/Manrope) do resto do app.
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

export default function PlanosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="planos-scope"
      className={`${jakarta.variable} ${instrumentSerif.variable} min-h-screen bg-[#0b0b10] text-[#f7f6f2]`}
      style={{ fontFamily: "var(--font-jakarta), system-ui, sans-serif" }}
    >
      {/* globals.css tem `h1,h2,h3 { font-family: var(--font-sora) }` pro
          resto do app — sobrescreve aqui pra qualquer título nessa rota
          (inclusive os <h2> dos cards de plano) cair na Jakarta, não na Sora. */}
      <style>{`
        #planos-scope h1,
        #planos-scope h2,
        #planos-scope h3 {
          font-family: var(--font-jakarta), system-ui, sans-serif;
        }
      `}</style>
      {children}
    </div>
  );
}

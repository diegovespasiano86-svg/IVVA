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
      className={`${jakarta.variable} ${instrumentSerif.variable} min-h-screen bg-[#f7f6f2] text-[#0e0e13]`}
      style={{ fontFamily: "var(--font-jakarta), system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}

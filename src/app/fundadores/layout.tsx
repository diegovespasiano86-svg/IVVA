import { Plus_Jakarta_Sans, Instrument_Serif } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", weight: "400", style: ["italic"], subsets: ["latin"] });

export default function FundadoresLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="fund-scope" className={`${jakarta.variable} ${instrumentSerif.variable} min-h-screen bg-[#0b0b10] text-[#f7f6f2]`} style={{ fontFamily: "var(--font-jakarta), system-ui, sans-serif" }}>
      <style>{`#fund-scope h1,#fund-scope h2,#fund-scope h3{font-family:var(--font-jakarta),system-ui,sans-serif}`}</style>
      {children}
    </div>
  );
}

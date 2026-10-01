"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-secondary btn-md print:hidden">
      <Printer size={15} /> Imprimir
    </button>
  );
}

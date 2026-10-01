"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atualiza os dados da tela a cada `segundos`, só com a aba visível. */
export default function AutoRefresh({ segundos = 20 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}

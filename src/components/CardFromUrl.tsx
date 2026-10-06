"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { Card } from "@/lib/cards/types";
import { GRADERS, type GraderId } from "@/lib/grading/companies";
import { useCard } from "./CardContext";
import { usePrices } from "./prices/PriceContext";

// Abre la carta del enlace (/?card=en-base1-4): así el escáner, y más adelante los álbumes o el
// portafolio, pueden llevarte a una carta concreta con su visor y sus precios.
export function CardFromUrl() {
  const params = useSearchParams();
  const id = params.get("card");
  // ext y lang permiten abrir cartas que aún no están en la caché del servidor (enlaces desde un álbum)
  const extra = params.get("ext") ? `?ext=${encodeURIComponent(params.get("ext")!)}&lang=${params.get("lang") === "JP" ? "JP" : "EN"}` : "";
  const { setCard } = useCard();
  // grader, grade y variant (desde el portafolio) abren la carta como tu slab: empresa, nota y versión
  const { setGrader, setGradeId, presetVariant } = usePrices();
  const variant = params.get("variant");
  const graderParam = params.get("grader") as GraderId | null;
  const grader = graderParam && graderParam in GRADERS ? graderParam : null;
  const grade = grader && GRADERS[grader].grades.some((o) => o.id === params.get("grade")) ? params.get("grade") : null;

  useEffect(() => {
    if (!id) return;
    const ctl = new AbortController();
    fetch(`/api/cards/${encodeURIComponent(id)}${extra}`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Card>) : null))
      .then((c) => {
        if (!c) return;
        if (variant && c.variantOptions?.some((o) => o.key === variant)) presetVariant(c.id, variant);
        setCard(c);
        if (grader) setGrader(grader);
        if (grade) setGradeId(grade);
        document.getElementById("top")?.scrollIntoView();
      })
      .catch(() => {});
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las funciones del contexto cambian en cada render
  }, [id, extra, setCard, grader, grade, variant]);

  return null;
}

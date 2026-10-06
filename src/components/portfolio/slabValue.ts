import { gradeOption } from "@/lib/grading/companies";
import { today } from "@/lib/portfolio/logic";
import type { Holding } from "@/lib/portfolio/types";
import { makeManual } from "@/lib/prices/manual";
import { manualStore } from "@/lib/prices/manual-store";

// Guarda lo que vale hoy un slab como precio puesto a mano de su carta, versión y nota. Es el mismo
// precio que se ve en la ficha de la carta ("Tus precios"): un solo sitio para los precios del usuario.
export function saveSlabValue(h: Pick<Holding, "card" | "variant" | "grader" | "gradeId" | "currency">, price: number) {
  return manualStore.save(
    makeManual({
      cardId: h.card.id,
      variant: h.variant,
      grader: h.grader,
      grade: gradeOption(h.grader, h.gradeId).value,
      date: today(),
      price,
      currency: h.currency,
    }),
  );
}

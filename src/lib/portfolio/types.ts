import type { AlbumCard } from "@/lib/collection/types";
import type { GraderId } from "@/lib/grading/companies";

// Un slab de tu portafolio: qué carta y versión, qué empresa y nota, y lo que te costó.
export interface Holding {
  id: string;
  card: AlbumCard; // misma forma que en los álbumes (imagen, enlace al visor)
  variant: string; // clave de VariantOption o "standard"
  variantName?: string; // etiqueta legible guardada al añadir ("Reverse holo")
  grader: GraderId;
  gradeId: string; // id de la nota en la escala de la empresa: "10", "9.5", "p10"
  cert?: string; // número de certificado (opcional)
  cost: number; // precio de compra
  currency: string;
  bought: string; // AAAA-MM-DD
  addedAt: string;
  updatedAt: string;
}

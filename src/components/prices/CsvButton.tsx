"use client";

import { es } from "@/lib/i18n/es";
import { usePrices } from "./PriceContext";

// Botón "Importar CSV" de la sección Cómo funciona.
export function CsvButton() {
  const { pickCsv } = usePrices();
  return (
    <button type="button" className="btn" onClick={pickCsv}>
      {es.how.importCsv}
    </button>
  );
}

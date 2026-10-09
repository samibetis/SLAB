"use client";

import { useI18n } from "@/components/I18nProvider";
import { usePrices } from "./PriceContext";

// Botón "Importar CSV" de la sección Cómo funciona.
export function CsvButton() {
  const { t: dict } = useI18n();
  const { pickCsv } = usePrices();
  return (
    <button type="button" className="btn" onClick={pickCsv}>
      {dict.how.importCsv}
    </button>
  );
}

"use client";

import { variantLabel } from "@/lib/cards/format";
import { useI18n } from "@/components/I18nProvider";
import { usePrices } from "./PriceContext";
import s from "./Prices.module.css";

// Selector de versión (unlimited, shadowless, 1ª edición, reverse...). Solo aparece si la carta
// tiene más de una; cada versión tiene su propio precio y su propio CSV.
export function VariantPicker() {
  const { t: dict } = useI18n();
  const { variants, variant, setVariant } = usePrices();
  if (variants.length < 2) return null;
  return (
    <label className={s.variant}>
      <span>{dict.prices.versionLabel}</span>
      <select value={variant} onChange={(e) => setVariant(e.target.value)} aria-describedby="variant-hint">
        {variants.map((v) => (
          <option key={v.key} value={v.key}>{variantLabel(v, dict)}</option>
        ))}
      </select>
      <small id="variant-hint">{dict.prices.versionHint}</small>
    </label>
  );
}

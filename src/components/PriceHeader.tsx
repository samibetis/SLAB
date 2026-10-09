"use client";

import { langName, metaLine } from "@/lib/cards/format";
import { useI18n } from "@/components/I18nProvider";
import { useCard } from "./CardContext";
import { AddToAlbum } from "./collection/AddToAlbum";
import { AddToPortfolio } from "./portfolio/AddToPortfolio";
import { VariantPicker } from "./prices/VariantPicker";
import s from "./Sections.module.css";

// Cabecera de la sección de precios: la carta elegida y su selector de versión, o la invitación a buscarla.
export function PriceHeader() {
  const { t: dict } = useI18n();
  const { card } = useCard();
  return (
    <>
      <h2 id="title">{card ? card.name : dict.prices.title}</h2>
      <p className={s.meta}>
        {card ? [metaLine(card), langName(card.language, dict)].filter(Boolean).join(", ") : dict.prices.meta}
      </p>
      <div className="mt-[18px] flex flex-wrap items-center gap-x-6 gap-y-3">
        <VariantPicker />
        <div className="flex flex-wrap items-center gap-2">
          <AddToAlbum />
          <AddToPortfolio />
        </div>
      </div>
    </>
  );
}

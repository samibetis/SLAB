"use client";

import { langName, metaLine } from "@/lib/cards/format";
import { es } from "@/lib/i18n/es";
import { useCard } from "./CardContext";
import { AddToAlbum } from "./collection/AddToAlbum";
import { AddToPortfolio } from "./portfolio/AddToPortfolio";
import { VariantPicker } from "./prices/VariantPicker";
import s from "./Sections.module.css";

// Cabecera de la sección de precios: la carta elegida y su selector de versión, o la invitación a buscarla.
export function PriceHeader() {
  const { card } = useCard();
  return (
    <>
      <h2 id="title">{card ? card.name : es.prices.title}</h2>
      <p className={s.meta}>
        {card ? [metaLine(card), langName(card.language)].filter(Boolean).join(", ") : es.prices.meta}
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

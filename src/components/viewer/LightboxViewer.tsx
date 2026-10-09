"use client";

import { useEffect, useRef, useState } from "react";
import { BACK_FILES, BACK_INSET, backFor } from "@/lib/cards/back";
import type { CardLanguage, CardSummary } from "@/lib/cards/types";
import type { FoilMode } from "@/lib/cards/variants";
import { useI18n } from "@/components/I18nProvider";
import { createCardViewer, type CardViewer as Engine } from "@/lib/viewer/engine";

export interface LightboxCard extends CardSummary {
  id: string;
  language: CardLanguage;
  image: string | null; // imagen grande
  foil: FoilMode;
}

// Las de TCGdex llevan CORS; las demás (pokemontcg.io / scrydex) pasan por el proxy para que WebGL las lea
const textureSrc = (url: string) => (/^https:\/\/assets\.tcgdex\.net\//.test(url) ? url : `/api/img?u=${encodeURIComponent(url)}`);

function loadImage(src: string, cors: boolean) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("imagen no disponible"));
    img.src = src;
  });
}

// El mismo motor 3D del visor principal, sin funda ni controles: la carta sola, para mirarla de cerca
// dentro de otra página (Top 10). Se gira arrastrando, como en la portada.
export default function LightboxViewer({ card }: { card: LightboxCard }) {
  const { t: dict } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [noWebgl, setNoWebgl] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const family = (getComputedStyle(document.documentElement).getPropertyValue("--font-archivo").trim() || "Archivo") + ", Arial, sans-serif";
    let engine: Engine;
    try {
      engine = createCardViewer(stage, family, dict.viewer);
    } catch {
      queueMicrotask(() => setNoWebgl(true));
      return;
    }
    engine.setSlab(false);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [dict.viewer]);

  // Carta nueva (al abrir o al pasar a la siguiente): plantilla al instante, luego imagen, reverso y brillo
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setCard(card);
    engine.setFoil(card.foil);
    engine.reset();
    let stale = false;
    if (card.image)
      loadImage(textureSrc(card.image), true)
        .then((img) => !stale && engineRef.current === engine && engine.setCardImage(img))
        .catch(() => {});
    const back = backFor(card);
    loadImage(BACK_FILES[back], false)
      .then((img) => !stale && engineRef.current === engine && engine.setBack(img, BACK_INSET[back]))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [card]);

  if (noWebgl) return <p className="grid h-full place-items-center p-6 text-center text-[14px] text-muted">{dict.viewer.noWebgl}</p>;
  return (
    <div
      ref={stageRef}
      tabIndex={0}
      aria-label={dict.viewer.stageLabel}
      className="h-full w-full cursor-grab touch-pan-y outline-none active:cursor-grabbing [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full"
    />
  );
}

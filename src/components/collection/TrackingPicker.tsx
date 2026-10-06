"use client";

import { PRESETS, type Preset } from "@/lib/collection/versions";
import { es } from "@/lib/i18n/es";

// Tipo de master set: qué cuenta para completarlo. Se elige al crearlo y se puede cambiar después
// (las cartas marcadas no se pierden: solo cambia cómo se cuentan).
export function TrackingPicker({ value, onChange, compact = false }: { value: Preset; onChange: (p: Preset) => void; compact?: boolean }) {
  const t = es.collection;
  const keys = Object.keys(PRESETS) as Preset[];
  return (
    <fieldset>
      <legend className={compact ? "vh" : "mb-2 text-[13.5px] font-semibold"}>{t.trackingLabel}</legend>
      <div className={`grid gap-1 rounded-xl p-1 ${compact ? "grid-cols-3 bg-panel" : "grid-cols-1 bg-soft sm:grid-cols-3"}`}>
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            title={compact ? t.presets[k].hint : undefined}
            onClick={() => onChange(k)}
            className={`rounded-lg text-left transition-[background-color,color,box-shadow] duration-150 ${
              compact
                ? "px-3 py-2 text-[13px] font-semibold text-muted aria-pressed:bg-ink aria-pressed:text-panel"
                : "px-3 py-2.5 text-muted aria-pressed:bg-panel aria-pressed:text-ink aria-pressed:shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.14)]"
            }`}
          >
            <span className={compact ? "" : "block text-[13.5px] font-semibold"}>{t.presets[k].name}</span>
            {!compact && <span className="mt-0.5 block text-[12px] leading-snug">{t.presets[k].hint}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

"use client";

import { useId, useState, type ReactNode } from "react";
import type { AlbumCard } from "@/lib/collection/types";
import { GRADERS, GRADER_IDS, carryGrade, type GraderId } from "@/lib/grading/companies";
import { useI18n } from "@/components/I18nProvider";
import { relabelVariant } from "@/lib/cards/format";
import { parseAmount, today } from "@/lib/portfolio/logic";
import type { Holding } from "@/lib/portfolio/types";
import { SlabThumb } from "./SlabThumb";

export type HoldingDraft = Pick<Holding, "variant" | "variantName" | "grader" | "gradeId" | "cost" | "bought" | "cert"> & {
  value?: number; // valor de hoy en esa nota, si lo pone: se guarda como precio suyo (no es parte del slab)
};

const field = "min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-[15px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-ink focus:shadow-[0_0_0_3px_rgb(var(--shadow-tint)/0.08)]";

// Formulario de un slab: empresa, nota, precio y fecha de compra, certificado, valor de hoy (opcional,
// mientras no haya API de precios por nota) y (si se puede elegir) versión. La funda en miniatura de la izquierda cambia en directo con la empresa y la nota.
export function HoldingForm({
  card, meta, variants, initial, submitLabel, onSubmit, onCancel, aside,
}: {
  card: AlbumCard;
  meta?: string;
  variants?: { key: string; label: string }[]; // si llega, la versión se puede elegir
  initial: Partial<HoldingDraft> & Pick<HoldingDraft, "grader" | "gradeId" | "variant">;
  submitLabel: string;
  onSubmit: (d: HoldingDraft) => void | Promise<void>;
  onCancel: () => void;
  aside?: ReactNode; // acción extra junto a la carta ("Otra carta")
}) {
  const { t: dict, lang } = useI18n();
  const t = dict.portfolio;
  const id = useId();
  const [grader, setGrader] = useState<GraderId>(initial.grader);
  const [gradeId, setGradeId] = useState(initial.gradeId);
  const [variant, setVariant] = useState(initial.variant);
  const [cost, setCost] = useState(initial.cost != null ? String(initial.cost).replace(".", ",") : "");
  const [bought, setBought] = useState(initial.bought ?? today());
  const [cert, setCert] = useState(initial.cert ?? "");
  const [value, setValue] = useState("");
  const [errors, setErrors] = useState<{ cost?: string; bought?: string; value?: string }>({});
  const [busy, setBusy] = useState(false);
  const max = today();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(cost, lang);
    const worth = value.trim() ? parseAmount(value, lang) : null;
    const errs = {
      cost: amount == null || amount < 0 ? t.costInvalid : undefined,
      bought: !/^\d{4}-\d{2}-\d{2}$/.test(bought) || bought > max ? t.dateInvalid : undefined,
      value: value.trim() && !(worth && worth > 0) ? t.valueInvalid : undefined,
    };
    setErrors(errs);
    if (errs.cost || errs.bought || errs.value) return;
    setBusy(true);
    try {
      await onSubmit({
        grader, gradeId, variant, cost: Math.round(amount! * 100) / 100, bought, cert: cert.trim() || undefined,
        variantName: variants ? variants.find((v) => v.key === variant)?.label : initial.variantName,
        value: worth ?? undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {/* la carta y su funda en directo */}
      <div className="flex items-center gap-4">
        <SlabThumb card={card} grader={grader} gradeId={gradeId} className="w-[84px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold">{card.name}</p>
          {meta && <p className="mt-0.5 truncate text-[13.5px] text-muted">{meta}</p>}
          {!variants && initial.variantName && <p className="mt-0.5 truncate text-[13.5px] text-muted">{relabelVariant(initial.variantName, dict)}</p>}
          {aside && <div className="mt-2">{aside}</div>}
        </div>
      </div>

      {variants && variants.length > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">{t.version}</span>
          <select value={variant} onChange={(e) => setVariant(e.target.value)} className={field}>
            {variants.map((v) => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </select>
        </label>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13.5px] font-semibold">{t.grader}</legend>
        <div className="grid grid-cols-5 gap-1 rounded-xl bg-soft p-1">
          {GRADER_IDS.map((gid) => (
            <button
              key={gid}
              type="button"
              aria-pressed={grader === gid}
              onClick={() => {
                setGradeId(carryGrade(gid, gradeId));
                setGrader(gid);
              }}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-[13.5px] font-semibold text-muted transition-[background-color,color,transform] duration-150 active:scale-[0.96] aria-pressed:bg-panel aria-pressed:text-ink aria-pressed:shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.14)]"
            >
              <span className="size-2 rounded-full ring-1 ring-ink/15" style={{ background: GRADERS[gid].swatch }} aria-hidden />
              {gid}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">{t.grade}</span>
        <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} className={field}>
          {GRADERS[grader].grades.map((o) => (
            <option key={o.id} value={o.id}>{`${o.value} · ${o.word}`}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">{t.cost}</span>
          <input
            autoFocus
            data-autofocus
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            aria-invalid={!!errors.cost}
            aria-describedby={errors.cost ? `${id}-cost` : undefined}
            className={`${field} tabular-nums aria-invalid:border-down`}
          />
          {errors.cost && <span id={`${id}-cost`} className="text-[13px] text-down">{errors.cost}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">{t.bought}</span>
          <input
            type="date"
            value={bought}
            max={max}
            onChange={(e) => setBought(e.target.value)}
            aria-invalid={!!errors.bought}
            aria-describedby={errors.bought ? `${id}-date` : undefined}
            className={`${field} tabular-nums aria-invalid:border-down`}
          />
          {errors.bought && <span id={`${id}-date`} className="text-[13px] text-down">{errors.bought}</span>}
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">
          {t.valueToday} <span className="font-normal text-muted">({t.optional})</span>
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          aria-invalid={!!errors.value}
          aria-describedby={`${id}-value`}
          className={`${field} tabular-nums aria-invalid:border-down`}
        />
        <span id={`${id}-value`} className={`text-[13px] ${errors.value ? "text-down" : "text-muted"}`}>{errors.value ?? t.valueHint}</span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">
          {t.certLabel} <span className="font-normal text-muted">({t.optional})</span>
        </span>
        <input value={cert} onChange={(e) => setCert(e.target.value.slice(0, 24))} inputMode="numeric" autoComplete="off" className={`${field} tabular-nums`} />
      </label>

      <div className="mt-1 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl px-4 text-[14.5px] font-semibold text-muted transition-colors duration-150 hover:text-ink">
          {t.cancel}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-xl bg-ink px-5 text-[14.5px] font-semibold text-panel transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

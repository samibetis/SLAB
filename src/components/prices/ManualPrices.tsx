"use client";

import { CheckIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { gradeOption } from "@/lib/grading/companies";
import { es } from "@/lib/i18n/es";
import { parseAmount, today } from "@/lib/portfolio/logic";
import { dayLong, money } from "@/lib/prices/format";
import { gradeByKey, gradeKey } from "@/lib/prices/grades";
import { useCard } from "../CardContext";
import { SupportNote } from "../SupportNote";
import { usePrices } from "./PriceContext";

const field =
  "min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-[15px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-ink focus:shadow-[0_0_0_3px_rgb(var(--shadow-tint)/0.08)]";

// "Tus precios": el usuario apunta lo que vale la carta en cada nota (sin API de pago no hay otra forma
// de tener precios gradeados). Al lado, por qué es así y cómo apoyar el proyecto.
export function ManualPrices() {
  const t = es.manual;
  const { card } = useCard();
  const p = usePrices();
  const id = useId();
  // Nota por defecto: la de la funda del visor, si tiene casilla; si no, la más alta
  const viewerKey = gradeKey(p.grader, gradeOption(p.grader, p.gradeId).value);
  const [picked, setPicked] = useState<string | null>(null);
  const key = picked && p.grades.some((g) => g.key === picked) ? picked : p.grades.some((g) => g.key === viewerKey) ? viewerKey : p.grades.at(-1)!.key;
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ price?: string; date?: string }>({});
  const [saved, setSaved] = useState(false);
  if (!card) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(price);
    const errs = {
      price: amount == null || !(amount > 0) ? t.invalidPrice : undefined,
      date: !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today() ? t.invalidDate : undefined,
    };
    setErrors(errs);
    if (errs.price || errs.date) return;
    const g = gradeByKey(key)!;
    try {
      await p.addManual({ grader: g.grader, grade: g.grade, price: amount!, date, note });
      setPrice("");
      setNote("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch {
      alert(t.storageError);
    }
  }

  const list = [...p.manual].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const label = (k: string) => gradeByKey(k)?.label ?? k;

  return (
    <div className="mt-10 grid items-start gap-8 border-t border-line pt-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-12">
      <div>
        <h3 className="text-[18px]! font-bold!">{t.title}</h3>
        <p className="mt-1.5 max-w-[60ch] text-[14.5px] leading-relaxed text-muted">{t.lead}</p>

        <form onSubmit={submit} noValidate className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">{t.grade}</span>
            <select value={key} onChange={(e) => setPicked(e.target.value)} className={field}>
              {p.grades.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">{t.price(p.currency)}</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? `${id}-p` : undefined}
              className={`${field} tabular-nums aria-invalid:border-down`}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <span className="text-[13.5px] font-semibold">{t.date}</span>
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.date}
              aria-describedby={errors.date ? `${id}-d` : undefined}
              className={`${field} tabular-nums aria-invalid:border-down`}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[13.5px] font-semibold">
              {t.note} <span className="font-normal text-muted">({t.optional})</span>
            </span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder={t.notePlaceholder} className={field} />
          </label>
          <div className="col-span-2 flex items-end gap-3 sm:col-span-1">
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-[14.5px] font-semibold text-panel transition-transform duration-150 active:scale-[0.97]"
            >
              {saved ? <CheckIcon size={16} weight="bold" aria-hidden /> : <PlusIcon size={16} weight="bold" aria-hidden />}
              {t.add}
            </button>
          </div>
          <div className="col-span-2 min-h-[1px] sm:col-span-3" aria-live="polite">
            {errors.price && <p id={`${id}-p`} className="text-[13px] text-down">{errors.price}</p>}
            {errors.date && <p id={`${id}-d`} className="text-[13px] text-down">{errors.date}</p>}
            {!errors.price && !errors.date && <p className="text-[12.5px] text-muted">{t.sameDay}</p>}
          </div>
        </form>

        <div className="mt-6">
          {list.length === 0 ? (
            <p className="text-[14px] text-muted">{t.empty}</p>
          ) : (
            <>
              <p className="text-[13.5px] font-semibold text-muted">{t.listTitle(list.length)}</p>
              <ul className="mt-2">
                <AnimatePresence initial={false}>
                  {list.map((m) => {
                    const k = gradeKey(m.grader, m.grade);
                    const what = `${label(k)} ${dayLong(m.date)}`;
                    return (
                      <motion.li
                        key={m.id}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-3 border-t border-line py-2.5 text-[14px] first:border-t-0"
                      >
                        <span className="w-[76px] shrink-0 font-semibold">{label(k)}</span>
                        <span className="w-[88px] shrink-0 text-right font-semibold tabular-nums">{money(m.price, m.currency)}</span>
                        <span className="min-w-0 flex-1 truncate text-muted">
                          {dayLong(m.date)}
                          {m.note ? ` · ${m.note}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => void p.removeManual(m.id)}
                          aria-label={t.removeLabel(what)}
                          title={t.remove}
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-soft hover:text-down"
                        >
                          <XIcon size={14} weight="bold" aria-hidden />
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </>
          )}
        </div>
      </div>
      <SupportNote />
    </div>
  );
}

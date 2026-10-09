"use client";

import type { CSSProperties } from "react";
import { useCard } from "../CardContext";
import { useI18n } from "@/components/I18nProvider";
import { lastValue, slice, stats } from "@/lib/prices/analyzer";
import { GRADERS, GRADER_IDS } from "@/lib/grading/companies";
import { RANGES } from "@/lib/prices/ranges";
import { PriceChart } from "./PriceChart";
import { usePrices } from "./PriceContext";
import s from "./Prices.module.css";

// Casillas por grado (precio actual y variación; pulsar muestra u oculta su línea), periodos,
// escala, gráfica y la línea que dice de dónde salen los datos y hasta cuándo.
export function PricesPanel() {
  const { t: dict, f: fmt } = useI18n();
  const t = dict.prices;
  const { card } = useCard();
  const p = usePrices();
  const hasData = p.status === "ready" && p.rows.length > 0;
  const rows = slice(p.rows, p.range);
  const rangeName = t.rangeNames[p.range];
  const until = fmt.monthLong(p.asOf);

  let sourceText = "";
  if (p.status === "loading") sourceText = t.loading;
  else if (p.status === "error") sourceText = t.fetchError;
  else if (card && !hasData) sourceText = `${t.noPrices} ${t.noPricesCsv}`;
  else if (hasData && p.source) {
    // raw real (TCGdex) + de dónde salen los precios por nota: ejemplo, los tuyos o pendientes
    const raw = p.source.raw;
    const n = p.manual.length;
    // ¿precios por nota de un proveedor real? (la fuente no es la del raw)
    const paid = !p.source.synthetic && !!raw && p.source.label !== raw.label;
    const graded = p.source.synthetic ? t.gradedMock : paid ? t.gradedFrom(p.source.label, n) : n ? t.gradedManual(n) : t.gradedNone;
    sourceText = p.source.file
      ? t.sourceCsv(p.source.file, until)
      : raw
        ? t.sourceRaw(raw.label, fmt.dayLong(raw.date), fmt.dayLong(raw.since)) + graded
        : p.source.synthetic
          ? t.sourceMock(until)
          : t.sourceDb(p.source.label, until);
  } else if (hasData && p.manual.length) sourceText = t.sourceManual(p.manual.length);

  return (
    <>
      <div className={s.tiles}>
        {p.grades.map((g) => {
          const st = hasData ? stats(rows, g.key) : null;
          const on = p.visible.has(g.key);
          return (
            <button
              key={g.key}
              type="button"
              className={s.tile}
              style={{ "--c": `var(${g.color})` } as CSSProperties}
              aria-pressed={on}
              title={on ? t.hideLine : t.showLine}
              onClick={() => p.toggleGrade(g.key)}
            >
              <span className={s.lbl}><i className="sw" />{g.label}</span>
              <span className={s.pr}>{hasData ? fmt.money(lastValue(p.rows, g.key), p.currency) : "—"}</span>
              <span className={`${s.ch} ${st ? (st.change >= 0 ? "up" : "down") : ""}`}>
                {st ? t.changeIn(fmt.pct(st.change), p.range) : ""}
              </span>
            </button>
          );
        })}
      </div>
      <div className={s.bar}>
        <div className={s.seg} role="group" aria-label={t.graderLabel}>
          {GRADER_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={p.grader === id} onClick={() => p.setGrader(id)}>
              {GRADERS[id].name}
            </button>
          ))}
        </div>
        <div className={s.seg} role="group" aria-label={t.rangesLabel}>
          {RANGES.map((r) => (
            <button key={r.k} type="button" title={t.rangeNames[r.k]} aria-pressed={p.range === r.k} onClick={() => p.setRange(r.k)}>
              {t.rangeShort[r.k]}
            </button>
          ))}
        </div>
        <label className="chk">
          <input type="checkbox" checked={p.log} onChange={(e) => p.setLog(e.target.checked)} /> {t.log}
        </label>
      </div>
      <div className={s.chartwrap}>
        {hasData ? (
          <PriceChart rows={rows} grades={p.grades.filter((g) => p.visible.has(g.key))} log={p.log} currency={p.currency} rangeName={rangeName} />
        ) : (
          <p className="empty">{!card ? t.chartEmpty : p.status === "loading" ? t.loading : p.status === "error" ? t.fetchError : t.noPricesCsv}</p>
        )}
      </div>
      <p className={s.source} aria-live="polite">
        {sourceText && <span>{sourceText}</span>}
        {p.status === "error" && <button type="button" className="linkbtn" onClick={p.retry}>{t.retry}</button>}
        {card && p.status !== "loading" && p.source?.file && (
          <button type="button" className="linkbtn" onClick={p.removeCsv}>{t.csvRemove}</button>
        )}
        {card && p.status !== "loading" && <button type="button" className="linkbtn" onClick={p.pickCsv}>{t.csvBtn}</button>}
        {p.notice && <span>{p.notice}</span>}
      </p>
    </>
  );
}

"use client";

import { useCard } from "../CardContext";
import { useI18n } from "@/components/I18nProvider";
import { changeMatrix, details, facts, slice } from "@/lib/prices/analyzer";
import { gradeByKey } from "@/lib/prices/grades";
import { RANGES } from "@/lib/prices/ranges";
import { readingText } from "@/lib/prices/reading";
import { usePrices } from "./PriceContext";
import s from "./Prices.module.css";

// Intensidad del color según cuánto se movió (más de ±60 % = tope)
function Pill({ v }: { v: number }) {
  const { f: fmt } = useI18n();
  const a = Math.round(8 + Math.min(Math.abs(v) / 0.6, 1) * 30);
  return (
    <span className={s.pill} style={{ background: `color-mix(in srgb, var(${v >= 0 ? "--up" : "--down"}) ${a}%, transparent)` }}>
      {fmt.pct(v)}
    </span>
  );
}

const Grade = ({ k }: { k: string }) => {
  const g = gradeByKey(k)!;
  return <><i className="sw" style={{ "--c": `var(${g.color})` } as React.CSSProperties} />{g.label}</>;
};

// Matriz grado x periodo, detalle del periodo elegido y lectura automática.
export function AnalysisPanel() {
  const { t: dict, f: fmt } = useI18n();
  const t = dict.analysis;
  const { card } = useCard();
  const p = usePrices();

  if (p.status !== "ready" || !p.rows.length) {
    return <p className="empty">{card && p.status === "loading" ? t.loading : card && p.status === "ready" ? dict.prices.noPricesCsv : t.empty}</p>;
  }

  const KEYS = p.grades.map((g) => g.key);
  const rangeName = dict.prices.rangeNames[p.range];
  const matrix = changeMatrix(p.rows, KEYS);
  const rows = slice(p.rows, p.range);
  const det = details(rows, KEYS);
  const f = facts(det, KEYS[KEYS.length - 1]);
  const c = t.cols;

  return (
    <>
      <div className={s.grid2}>
        <div>
          <h3>{t.byPeriod}</h3>
          <div className={s.tbl}>
            <table>
              <thead>
                <tr><th>{c.grade}</th>{RANGES.map((r) => <th key={r.k}>{dict.prices.rangeShort[r.k]}</th>)}</tr>
              </thead>
              <tbody>
                {KEYS.map((k) => (
                  <tr key={k}>
                    <td><Grade k={k} /></td>
                    {RANGES.map((r) => {
                      const v = matrix[k][r.k];
                      return <td key={r.k}>{v == null ? <span className={s.na}>—</span> : <Pill v={v} />}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3>{t.detailIn(rangeName)}</h3>
          <div className={s.tbl}>
            <table>
              <thead>
                <tr>
                  <th>{c.grade}</th><th>{c.current}</th><th>{c.min}</th><th>{c.max}</th>
                  <th title={c.volHint}>{c.vol}</th><th title={c.ddHint}>{c.dd}</th><th title={c.vsRawHint}>{c.vsRaw}</th>
                </tr>
              </thead>
              <tbody>
                {det.map(({ key, st, vsRaw }) => (
                  <tr key={key}>
                    <td><Grade k={key} /></td>
                    {st ? (
                      <>
                        <td>{fmt.money(st.last, p.currency)}</td>
                        <td>{fmt.money(st.min, p.currency)}</td>
                        <td>{fmt.money(st.max, p.currency)}</td>
                        <td>±{fmt.num1(st.vol * 100)}%</td>
                        <td className={st.dd < -0.001 ? "down" : ""}>{st.dd < -0.001 ? fmt.pct(st.dd) : "0%"}</td>
                        <td>{vsRaw != null ? `${fmt.num1(vsRaw)}×` : "—"}</td>
                      </>
                    ) : (
                      <td colSpan={6} className={s.na}>{t.noData}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {f && <p className={s.read}>{readingText(f, rangeName, (k) => gradeByKey(k)?.label ?? k, dict, fmt)}</p>}
    </>
  );
}

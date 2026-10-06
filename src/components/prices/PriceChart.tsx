"use client";

import { useEffect, useRef, useState } from "react";
import { es } from "@/lib/i18n/es";
import { xLabelIndexes, yScale } from "@/lib/prices/chart";
import { money, moneyCompact, monthLong, monthShort } from "@/lib/prices/format";
import type { GradeDef } from "@/lib/prices/grades";
import type { Row } from "@/lib/prices/types";
import s from "./Prices.module.css";

const M = { l: 56, r: 14, t: 14, b: 30 };

// Gráfica de líneas por grado en SVG: escala logarítmica o lineal, ejes, y línea guía con tooltip.
export function PriceChart({
  rows, grades, log, currency, rangeName,
}: { rows: Row[]; grades: GradeDef[]; log: boolean; currency: string; rangeName: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  // El ancho de la gráfica sigue al de su caja
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vals = rows.flatMap((r) => grades.map((g) => r.p[g.key]).filter((v): v is number => !!v));
  if (rows.length < 2 || !vals.length) {
    return <div ref={wrap}><p className="empty">{es.prices.chartNoData}</p></div>;
  }

  const H = Math.round(Math.min(380, Math.max(240, w * 0.48)));
  const iw = w - M.l - M.r;
  const ih = H - M.t - M.b;
  const { ticks, y } = yScale(vals, log, M.t, ih);
  const x = (i: number) => M.l + (i * iw) / (rows.length - 1);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - b.left) * w) / b.width;
    setHover(Math.min(rows.length - 1, Math.max(0, Math.round(((px - M.l) / iw) * (rows.length - 1)))));
  };

  const hr = hover !== null ? rows[Math.min(hover, rows.length - 1)] : null;
  const hi = hover !== null ? Math.min(hover, rows.length - 1) : 0;

  return (
    <div ref={wrap} className={s.chartbox}>
      <svg
        viewBox={`0 0 ${w} ${H}`} width={w} height={H} role="img" aria-label={es.prices.chartLabel(rangeName)}
        className={s.svg} onPointerMove={onMove} onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => {
          const ty = y(t);
          if (ty < M.t - 1 || ty > M.t + ih + 1) return null;
          return (
            <g key={t}>
              <line className={s.grid} x1={M.l} x2={w - M.r} y1={ty} y2={ty} />
              <text className={s.axis} x={M.l - 8} y={ty + 4} textAnchor="end">{moneyCompact(t, currency)}</text>
            </g>
          );
        })}
        {xLabelIndexes(rows.length).map((i) => (
          <text key={i} className={s.axis} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"}>
            {monthShort(rows[i].t)}
          </text>
        ))}
        {grades.map((g) => {
          // los meses sin dato cortan la línea en vez de unir los extremos
          let d = "";
          let pen = false;
          rows.forEach((r, i) => {
            const v = r.p[g.key];
            if (v) { d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; pen = true; } else pen = false;
          });
          return (
            <path key={g.key} d={d} fill="none" stroke={`var(${g.color})`} strokeWidth={g.key === "psa10" ? 2.6 : 2}
              strokeLinejoin="round" strokeLinecap="round" />
          );
        })}
        {hr && (
          <g>
            <line x1={x(hi)} x2={x(hi)} y1={M.t} y2={M.t + ih} stroke="var(--muted)" strokeDasharray="3 3" />
            {grades.map((g) => {
              const v = hr.p[g.key];
              return v ? <circle key={g.key} cx={x(hi)} cy={y(v)} r={4} fill="var(--panel)" stroke={`var(${g.color})`} strokeWidth={2} /> : null;
            })}
          </g>
        )}
        <rect x={M.l} y={M.t} width={iw} height={ih} fill="transparent" />
      </svg>
      {hr && (
        <div
          className={s.tip}
          style={{ left: `${(x(hi) / w) * 100}%`, transform: x(hi) > w / 2 ? "translateX(calc(-100% - 14px))" : "translateX(14px)" }}
        >
          <strong>{monthLong(hr.t)}</strong>
          {grades.slice().reverse().map((g) => (
            <div key={g.key}><span>{g.label}</span><span>{money(hr.p[g.key], currency)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

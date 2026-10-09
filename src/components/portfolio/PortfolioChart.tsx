"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { TimelinePoint } from "@/lib/portfolio/logic";
import { xLabelIndexes, yScale } from "@/lib/prices/chart";

const M = { l: 52, r: 12, t: 12, b: 28 };

// Valor del portafolio (área) frente a lo pagado (línea discontinua), mes a mes. El hueco entre las
// dos es la ganancia o la pérdida. Escala lineal desde 0 para no exagerar los movimientos.
export function PortfolioChart({ points, currency }: { points: TimelinePoint[]; currency: string }) {
  const { t: dict, f: fmt } = useI18n();
  const t = dict.portfolio;
  const gid = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!points.length) {
    return (
      <div ref={wrap} className="grid min-h-[220px] place-items-center rounded-2xl border border-dashed border-line px-6 text-center text-[14.5px] text-muted">
        {t.chartEmpty}
      </div>
    );
  }

  const H = Math.round(Math.min(320, Math.max(220, w * 0.42)));
  const iw = w - M.l - M.r;
  const ih = H - M.t - M.b;
  const n = points.length;
  const { ticks, y } = yScale([...points.map((p) => p.value), ...points.map((p) => p.cost), 1], false, M.t, ih);
  // Con un solo mes, el punto va centrado
  const x = (i: number) => (n === 1 ? M.l + iw / 2 : M.l + (i * iw) / (n - 1));
  const line = (k: "value" | "cost") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const area = `${line("value")}L${x(n - 1).toFixed(1)},${M.t + ih}L${x(0).toFixed(1)},${M.t + ih}Z`;
  const hp = hover != null ? points[hover] : null;
  const drawKey = `${points[0].t}-${n}`;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - b.left) * w) / b.width;
    setHover(n === 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round(((px - M.l) / iw) * (n - 1)))));
  };

  return (
    <div ref={wrap} className="relative">
      <svg
        viewBox={`0 0 ${w} ${H}`}
        className="block h-auto w-full touch-pan-y overflow-visible"
        role="img"
        aria-label={t.chartLabel}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${gid}-a`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--ink)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={w - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={M.l - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px] tabular-nums">
              {fmt.moneyCompact(v, currency)}
            </text>
          </g>
        ))}
        {xLabelIndexes(n).map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted text-[11px]">
            {fmt.monthShort(points[i].t)}
          </text>
        ))}
        {/* key: al cambiar de periodo la línea se vuelve a dibujar */}
        {n > 1 && <path key={`a-${drawKey}`} d={area} fill={`url(#${gid}-a)`} className="chart-fill" />}
        <path d={line("cost")} fill="none" stroke="var(--muted)" strokeWidth={1.6} strokeDasharray="5 5" strokeLinejoin="round" />
        <path key={`v-${drawKey}`} d={line("value")} pathLength={1} className="chart-draw" fill="none" stroke="var(--ink)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {(n === 1 || hp) && (
          <g>
            {hp && <line x1={x(hover!)} x2={x(hover!)} y1={M.t} y2={M.t + ih} stroke="var(--ink)" strokeOpacity={0.25} />}
            <circle cx={x(hover ?? 0)} cy={y((hp ?? points[0]).value)} r={4.5} fill="var(--panel)" stroke="var(--ink)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-xl bg-ink px-3 py-2.5 text-[12.5px] text-panel"
          style={{ left: `${(x(hover!) / w) * 100}%`, transform: `translateX(${hover! > n / 2 ? "calc(-100% - 12px)" : "12px"})` }}
        >
          <strong className="mb-1 block font-semibold first-letter:uppercase">{fmt.monthLong(hp.t)}</strong>
          <div className="flex justify-between gap-4"><span>{t.chartValue}</span><b className="tabular-nums">{fmt.money(hp.value, currency)}</b></div>
          <div className="flex justify-between gap-4 opacity-75"><span>{t.chartCost}</span><span className="tabular-nums">{fmt.money(hp.cost, currency)}</span></div>
          <div className="mt-1 flex justify-between gap-4 border-t border-panel/20 pt-1">
            <span>{t.slabs(hp.count)}</span>
            <span className="tabular-nums">{fmt.pct(hp.cost > 0 ? hp.value / hp.cost - 1 : null)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

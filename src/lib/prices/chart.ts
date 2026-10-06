// Geometría de la gráfica: escalas y marcas de los ejes. Puro, sin DOM.

export const niceStep = (raw: number) => {
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((x) => x * p).find((x) => x >= raw)!;
};

// Marcas 1-2-5 por década en escala logarítmica; si salen demasiadas, solo las potencias de 10.
export function logTicks(lo: number, hi: number): number[] {
  let out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= lo && v <= hi) out.push(v);
    }
  if (out.length > 7) out = out.filter((v) => /^1/.test(String(v)));
  if (out.length < 3) {
    const st = niceStep((hi - lo) / 4);
    out = [];
    for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) out.push(v);
  }
  return out;
}

export interface YScale {
  ticks: number[];
  y: (v: number) => number; // precio -> píxel
}

// Escala vertical para unos valores. Log: con un pequeño margen en décadas. Lineal: desde 0.
export function yScale(values: number[], log: boolean, top: number, height: number): YScale {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  let y0: number, y1: number, ticks: number[];
  if (log) {
    y0 = Math.log10(lo);
    y1 = Math.log10(hi);
    const pad = Math.max(0.04, (y1 - y0) * 0.07);
    y0 -= pad;
    y1 += pad;
    ticks = logTicks(10 ** y0, 10 ** y1);
  } else {
    y0 = 0;
    y1 = hi * 1.06;
    const st = niceStep(y1 / 5);
    ticks = [];
    for (let v = 0; v <= y1; v += st) ticks.push(v);
  }
  const f = log ? Math.log10 : (v: number) => v;
  return { ticks, y: (v) => top + (1 - (f(v) - y0) / (y1 - y0)) * height };
}

// Qué meses llevan etiqueta en el eje X (unas 6, siempre incluido el último).
export const xLabelIndexes = (n: number): number[] => {
  const step = Math.max(1, Math.ceil(n / 6));
  return Array.from({ length: n }, (_, i) => i).filter((i) => (n - 1 - i) % step === 0);
};

import { cardImage } from "@/lib/collection/logic";
import type { AlbumCard } from "@/lib/collection/types";
import { GRADERS, gradeOption, labelColors, type GraderId } from "@/lib/grading/companies";

// Funda en miniatura, en CSS: proporciones reales de cada empresa y su etiqueta por código de color
// (marco, banda, oscura o metalizada), como en el visor 3D pero sin WebGL para poder pintar decenas.
// Las medidas salen de GRADERS (pulgadas) y se pasan a porcentajes; el texto escala con el ancho (cqw).
// `reveal` reproduce el "revelado de la nota": una tapa cubre la etiqueta, se retira y la nota entra
// enfocándose, y un destello cruza el plástico. `glare` añade un brillo que sigue al puntero (lo mueve
// el padre con las variables --gx, --gy y --glare). Las animaciones están en globals.css (.slab-*).
export function SlabThumb({
  card, grader, gradeId, className = "", reveal = false, delay = 0, glare = false,
}: { card: AlbumCard; grader: GraderId; gradeId: string; className?: string; reveal?: boolean; delay?: number; glare?: boolean }) {
  const g = GRADERS[grader];
  const opt = gradeOption(grader, gradeId);
  const c = labelColors(g, opt);
  const { w, h, labelH, insert } = g.slab;
  const side = (((w - 2.5) / 2) / w) * 100; // margen lateral de la carta, en % del ancho
  const label = { top: (0.13 / h) * 100, height: ((labelH - 0.26) / h) * 100 };
  const win = { top: ((labelH + 0.04) / h) * 100, height: (3.5 / h) * 100 };
  const src = cardImage(card);
  const labelBg =
    c.layout === "metal"
      ? `linear-gradient(135deg, ${c.bg}, color-mix(in srgb, ${c.bg} 70%, white) 45%, ${c.bg})`
      : c.layout === "band"
        ? `linear-gradient(${c.accent} 0 46%, ${c.bg} 46%)`
        : c.bg;

  return (
    <div
      className={`@container relative shrink-0 ${className}`}
      style={{ aspectRatio: `${w} / ${h}`, ["--d" as string]: `${delay}ms` }}
      aria-hidden
    >
      {/* carcasa */}
      <div
        className="absolute inset-0 border border-ink/20 shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.18),0_8px_18px_-10px_rgb(var(--shadow-tint)/0.45)]"
        style={{
          borderRadius: `${(g.slab.r / w) * 100}cqw`,
          // --slab-shell: opacidad del plástico según el tema (la misma que usa el visor)
          background:
            "linear-gradient(160deg, rgb(255 255 255 / calc(var(--slab-shell) * 1.8)), rgb(255 255 255 / calc(var(--slab-shell) * 0.4)) 40%, rgb(255 255 255 / var(--slab-shell)))",
        }}
      />
      {/* etiqueta */}
      <div
        className="absolute flex items-center justify-between overflow-hidden px-[4cqw] font-bold leading-none"
        style={{
          left: `${side}%`, right: `${side}%`, top: `${label.top}%`, height: `${label.height}%`,
          background: labelBg, color: c.ink,
          boxShadow: c.layout === "frame" ? `inset 0 0 0 1.6cqw ${c.accent}` : c.layout === "dark" ? `inset 0 -1.2cqw 0 ${c.accent}` : undefined,
          borderRadius: "1.5cqw",
        }}
      >
        <span
          className={`${c.layout === "band" ? "text-[7.5cqw]" : "text-[9cqw]"} tracking-[0.02em]`}
          style={{ color: c.layout === "band" ? "#fff" : c.sub, alignSelf: c.layout === "band" ? "flex-start" : undefined, marginTop: c.layout === "band" ? "1.3cqw" : undefined }}
        >
          {g.id}
        </span>
        <span className={`${c.layout === "band" ? "text-[13cqw]" : "text-[17cqw]"} tabular-nums [font-stretch:110%] ${reveal ? "slab-grade-in" : ""}`} style={{ alignSelf: c.layout === "band" ? "flex-end" : undefined, marginBottom: c.layout === "band" ? "1.5cqw" : undefined }}>
          {opt.value}
        </span>
        {reveal && <span className="slab-cover absolute inset-0" />}
      </div>
      {/* hueco de la carta */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: `${side - (insert === "black" ? 2.5 : 0)}%`, right: `${side - (insert === "black" ? 2.5 : 0)}%`,
          top: `${win.top}%`, height: `${win.height}%`,
          background: insert === "black" ? "#0d0e10" : "transparent",
          padding: insert === "black" ? "2.5cqw" : insert === "sleeve" ? "1cqw" : 0,
          borderRadius: "2.4cqw",
          boxShadow: insert === "sleeve" ? "inset 0 0 0 1cqw rgb(255 255 255 / 0.5)" : undefined,
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura de TCGdex, ya optimizada
          <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full rounded-[2cqw] object-cover" />
        ) : (
          <div className="h-full w-full rounded-[2cqw] bg-soft" />
        )}
      </div>
      {/* plástico por encima de todo: destello del revelado y brillo que sigue al puntero */}
      {(reveal || glare) && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: `${(g.slab.r / w) * 100}cqw` }}>
          {reveal && <span className="slab-sheen absolute -inset-y-[10%] left-0 w-[42%]" />}
          {glare && <span className="slab-glare absolute inset-0" />}
        </div>
      )}
    </div>
  );
}

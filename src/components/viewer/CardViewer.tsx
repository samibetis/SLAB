"use client";

import { CaretDownIcon, CertificateIcon, CrosshairIcon, ShieldCheckIcon, SparkleIcon, StampIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { createCardViewer, type CardViewer as Engine } from "@/lib/viewer/engine";
import { BACK_FILES, BACK_INSET, backFor } from "@/lib/cards/back";
import { variantEdition, versionOnlyLabel } from "@/lib/cards/format";
import { foilFor, hasReverse, stampFor, versionKey, versions, withReverse, withVersion } from "@/lib/cards/variants";
import { GRADERS, GRADER_IDS, type GraderId } from "@/lib/grading/companies";
import { useCard } from "../CardContext";
import { usePrices } from "../prices/PriceContext";

function loadImage(src: string, cors: boolean) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous"; // sin esto WebGL no puede usar la imagen como textura
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("imagen no disponible"));
    img.src = src;
  });
}

// Los reversos se cargan una sola vez y se reutilizan
const backCache = new Map<string, Promise<HTMLImageElement>>();
const loadBack = (src: string) => {
  let p = backCache.get(src);
  if (!p) backCache.set(src, (p = loadImage(src, false)));
  return p;
};

const readFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => loadImage(rd.result as string, false).then(resolve, reject);
    rd.onerror = () => reject(rd.error);
    rd.readAsDataURL(file);
  });

// Componente cliente del visor: monta el motor three.js, lo sincroniza con la carta elegida y los
// controles, y lo destruye. El escaneo del usuario entra por botón, Ctrl+V o arrastrando una imagen.
export default function CardViewer() {
  const { t: dict } = useI18n();
  const t = dict.viewer;
  const { card } = useCard();
  const { variants, variant, setVariant, grader, setGrader, gradeId, setGradeId } = usePrices();
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slabOn, setSlabOn] = useState(true);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null); // foto de versión que no cargó
  const [scanKey, setScanKey] = useState<string | null>(null); // carta a la que pertenece el escaneo
  const [dragging, setDragging] = useState(false);
  const cardKey = card?.id ?? "none";
  const hasScan = scanKey === cardKey; // al cambiar de carta, el escaneo se descarta solo

  // Crear y destruir el motor
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Los canvas pintan con el nombre real de la fuente que genera next/font (--font-archivo).
    const family = (getComputedStyle(document.documentElement).getPropertyValue("--font-archivo").trim() || "Archivo") + ", Arial, sans-serif";
    let engine: Engine;
    try {
      engine = createCardViewer(stage, family, t);
    } catch {
      // sin WebGL el constructor lanza; se avisa en el siguiente tick (no dentro del cuerpo del efecto)
      queueMicrotask(() => setError(t.noWebgl));
      return;
    }
    engineRef.current = engine;
    // Las texturas se dibujan antes de que la fuente esté lista: se repintan al cargarla.
    Promise.all(["700 44px", "800 72px", "500 30px", "600 24px"].map((f) => document.fonts.load(`${f} ${family}`)))
      .then(() => engineRef.current === engine && engine.redraw())
      .catch(() => {});
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [t]);

  // Carta nueva: la plantilla se dibuja al instante (y se descarta el escaneo anterior).
  useEffect(() => {
    engineRef.current?.setCard(card);
  }, [card, error]);

  // Si se llega desde el escáner, su captura se usa como "Tu escaneo" (la deja en sessionStorage).
  useEffect(() => {
    if (!card) return;
    const key = `slab:scan:${card.id}`;
    let data: string | null = null;
    try {
      data = sessionStorage.getItem(key);
    } catch {
      /* almacenamiento bloqueado: sin captura */
    }
    if (!data) return;
    let stale = false;
    loadImage(data, false)
      .then((img) => {
        if (stale) return;
        engineRef.current?.setScan(img);
        setScanKey(card.id);
        // se borra solo una vez aplicada (en desarrollo React ejecuta los efectos dos veces)
        try {
          sessionStorage.removeItem(key);
        } catch {}
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [card, error]);

  // Imagen: la foto de la versión elegida si tiene una propia (TCGplayer), si no la principal de la carta.
  // Mientras llega la nueva se queda la anterior; si la foto falla, se usa la principal.
  const current = variants.find((v) => v.key === variant);
  // Versión que no es la principal: el servidor busca su foto (producto propio o, con sello, por búsqueda).
  // Mientras responde se ve la imagen principal con el sello dibujado.
  const cardId = card?.id;
  const specialKey = current && current.key !== variants[0]?.key ? current.key : undefined;
  const [photoInfo, setPhotoInfo] = useState<{ key: string; url: string | null; name?: string } | null>(null);
  useEffect(() => {
    if (!cardId || !specialKey) return;
    const ctl = new AbortController();
    fetch(`/api/cards/${encodeURIComponent(cardId)}/variant-photo?variant=${encodeURIComponent(specialKey)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : { url: null }))
      .then((d: { url: string | null; productName?: string }) =>
        setPhotoInfo({ key: `${cardId}|${specialKey}`, url: d.url ?? null, name: d.productName }),
      )
      .catch(() => {});
    return () => ctl.abort();
  }, [cardId, specialKey]);
  const photo = specialKey && photoInfo?.key === `${cardId}|${specialKey}` ? photoInfo.url : null;
  const usePhoto = !!photo && photo !== failedPhoto;
  useEffect(() => {
    const engine = engineRef.current;
    const main = card?.imageUrl
      ? card.imageNeedsProxy ? `/api/img?u=${encodeURIComponent(card.imageUrl)}` : card.imageUrl
      : null;
    const src = usePhoto && photo ? `/api/img?u=${encodeURIComponent(photo)}` : main;
    if (!engine || !src) return;
    let stale = false;
    loadImage(src, true)
      .then((img) => !stale && engineRef.current === engine && engine.setCardImage(img))
      .catch(() => {
        if (!stale && usePhoto && photo) setFailedPhoto(photo);
      });
    return () => {
      stale = true;
    };
  }, [card, photo, usePhoto, error]);

  // Reverso real según idioma y época de la colección (internacional, japonés antiguo o japonés moderno)
  const back = backFor(card);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    let stale = false;
    loadBack(BACK_FILES[back])
      .then((img) => !stale && engineRef.current === engine && engine.setBack(img, BACK_INSET[back]))
      .catch(() => {}); // si falla, se queda el reverso dibujado
    return () => {
      stale = true;
    };
  }, [back, error]);

  // La versión elegida (reverse y versión especial) cambia el aspecto de la carta:
  // dónde cae el brillo holográfico, el sello y la edición de la etiqueta de la funda.
  const foil = foilFor(current, card?.rarity);
  // la foto propia ya trae el sello real: no se dibuja encima
  const stamp = usePhoto ? null : stampFor(current);
  useEffect(() => {
    engineRef.current?.setFoil(foil);
    engineRef.current?.setStamp(stamp);
  }, [foil, stamp, card, error]);
  const edition = variantEdition(current);
  useEffect(() => {
    if (card) engineRef.current?.updateCard({ ...card, edition });
  }, [card, edition, error]);

  // Empresa de gradeo y nota: forma de la funda y etiqueta
  useEffect(() => {
    engineRef.current?.setGrader(grader, gradeId);
  }, [grader, gradeId, error]);

  // Escaneo del usuario: usa la imagen y recuerda para qué carta era
  async function applyScan(file: File | undefined | null) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const img = await readFile(file);
      engineRef.current?.setScan(img);
      setScanKey(cardKey);
    } catch {
      /* imagen ilegible: se ignora */
    }
  }
  // applyScan cambia en cada render; los listeners de documento llaman siempre a la última versión.
  const scanRef = useRef(applyScan);
  useEffect(() => {
    scanRef.current = applyScan;
  });

  // Ctrl+V con una imagen en el portapapeles (no si se está escribiendo en un campo de texto)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!file) return;
      e.preventDefault();
      scanRef.current(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const versionList = versions(variants);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(false);
        scanRef.current(e.dataTransfer.files[0]);
      }}
    >
      {/* foco de luz suave detrás de la carta */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[6%] top-[4%] -z-10 aspect-square rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--panel)_75%,transparent),transparent)] blur-2xl"
      />
      <div
        ref={stageRef}
        tabIndex={0}
        aria-label={t.stageLabel}
        className={`relative mx-auto aspect-[3/4] w-[min(100%,calc(78dvh*0.75))] cursor-grab touch-pan-y overflow-hidden rounded-[2rem] outline-offset-[-6px] transition-[background-color] duration-300 focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full ${
          dragging ? "bg-accent/5 outline-2 outline-dashed outline-accent" : ""
        }`}
      >
        {error && <p className="absolute inset-0 m-0 grid place-items-center p-6 text-center text-muted">{error}</p>}
        {dragging && (
          <p className="pointer-events-none absolute inset-0 m-0 grid place-items-center p-6 text-center font-semibold">
            <span className="inline-flex items-center gap-2 rounded-full bg-panel/90 px-4 py-2 shadow-sm backdrop-blur">
              <UploadSimpleIcon size={18} weight="bold" aria-hidden />
              {t.dropHint}
            </span>
          </p>
        )}
      </div>

      {/* Barra de controles flotante, de cristal */}
      <div
        role="toolbar"
        aria-label={t.controls}
        className="relative mx-auto -mt-3 flex w-fit max-w-full flex-col items-stretch rounded-2xl bg-panel/75 p-1.5 shadow-[0_2px_6px_rgb(var(--shadow-tint)/0.08),0_20px_44px_-24px_rgb(var(--shadow-tint)/0.5)] backdrop-blur-xl"
      >
        {/* Fila 1: la funda (si está puesta, de qué empresa y con qué nota) */}
        <div className="flex flex-wrap items-center justify-center gap-1">
        <DockToggle
          pressed={slabOn}
          onClick={() => {
            setSlabOn(!slabOn);
            engineRef.current?.setSlab(!slabOn);
          }}
          icon={<ShieldCheckIcon size={17} weight={slabOn ? "fill" : "regular"} aria-hidden />}
          label={t.slab}
        />
        <DockSelect
          label={t.grader}
          icon={<CertificateIcon size={16} aria-hidden />}
          value={grader}
          disabled={!slabOn}
          onChange={(v) => setGrader(v as GraderId)}
          options={GRADER_IDS.map((id) => ({ value: id, label: GRADERS[id].name }))}
        />
        <DockSelect
          label={t.gradeLabel}
          icon={<span className="text-[11px] font-bold tracking-wide">{t.grade}</span>}
          value={gradeId}
          disabled={!slabOn}
          wideIcon
          onChange={setGradeId}
          options={GRADERS[grader].grades.map((o) => ({ value: o.id, label: `${o.value} · ${o.word}` }))}
        />
        </div>
        {/* Fila 2: la carta (versión, escaneo propio y centrar) */}
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1 border-t border-line/70 pt-1.5">
        {current && hasReverse(variants) && (
          <DockToggle
            pressed={current.type === "reverse"}
            onClick={() => {
              const o = withReverse(variants, current, current.type !== "reverse");
              if (o) setVariant(o.key);
            }}
            icon={<SparkleIcon size={17} weight={current.type === "reverse" ? "fill" : "regular"} aria-hidden />}
            label={t.reverse}
          />
        )}
        {current && versionList.length > 1 && (
          <DockSelect
            label={t.versionLabel}
            icon={<StampIcon size={16} aria-hidden />}
            value={versionKey(current)}
            onChange={(v) => {
              const o = withVersion(variants, current, v);
              if (o) setVariant(o.key);
            }}
            options={versionList.map((v) => ({ value: versionKey(v), label: versionOnlyLabel(v, dict) }))}
          />
        )}
        <input
          id="scan"
          type="file"
          accept="image/*"
          className="peer vh"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            applyScan(f);
          }}
        />
        <label
          htmlFor="scan"
          title={t.useScan}
          className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-muted transition-[color,transform] duration-200 hover:text-ink active:scale-[0.97] peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
        >
          <UploadSimpleIcon size={17} aria-hidden />
          {t.scanShort}
        </label>
        {hasScan && (
          <button
            type="button"
            onClick={() => {
              engineRef.current?.setScan(null);
              setScanKey(null);
            }}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-[13px] font-semibold text-down transition-transform duration-200 active:scale-[0.97]"
          >
            <XIcon size={15} weight="bold" aria-hidden />
            {t.removeShort}
          </button>
        )}
        <button
          type="button"
          title={t.center}
          aria-label={t.center}
          onClick={() => engineRef.current?.reset()}
          className="inline-flex size-10 items-center justify-center rounded-xl text-muted transition-[color,transform] duration-200 hover:text-ink active:scale-[0.94]"
        >
          <CrosshairIcon size={18} aria-hidden />
        </button>
        </div>
      </div>
      <p className="mt-3 text-center text-[12.5px] text-muted">
        {usePhoto ? `${t.photoNote} · TCGplayer` : t.hintShort.join(" · ")}
      </p>
    </div>
  );
}

// Botón de la barra que se queda pulsado (funda, reverse).
function DockToggle({ pressed, onClick, icon, label }: { pressed: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-muted transition-[background-color,color,transform] duration-200 hover:text-ink active:scale-[0.97] aria-pressed:bg-ink aria-pressed:text-panel"
    >
      {icon}
      {label}
    </button>
  );
}

// Desplegable de la barra con icono delante y flecha detrás (nota, versión).
function DockSelect({
  label, icon, value, options, onChange, disabled, wideIcon,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  wideIcon?: boolean;
}) {
  return (
    <span className={`relative inline-flex items-center ${disabled ? "opacity-45" : ""}`}>
      <span className="pointer-events-none absolute left-2.5 inline-flex text-muted">{icon}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-10 max-w-[11.5rem] appearance-none truncate rounded-xl border-0 bg-soft py-0 pr-7 text-[13px] font-semibold text-ink transition-colors duration-200 hover:bg-line/60 disabled:cursor-default disabled:opacity-100 ${
          wideIcon ? "pl-12" : "pl-8"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDownIcon size={13} weight="bold" className="pointer-events-none absolute right-2.5 text-muted" aria-hidden />
    </span>
  );
}

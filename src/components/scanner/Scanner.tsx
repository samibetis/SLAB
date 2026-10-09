"use client";

import {
  ArrowCounterClockwiseIcon, ArrowRightIcon, CameraIcon, CameraRotateIcon, CheckIcon, CircleNotchIcon,
  FrameCornersIcon, HashIcon, MagicWandIcon, ScanIcon, SunIcon, UploadSimpleIcon, WarningCircleIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { metaLine } from "@/lib/cards/format";
import type { Card } from "@/lib/cards/types";
import { useI18n } from "@/components/I18nProvider";
import { cropFromImage, cropFromVideo, region } from "@/lib/scan/image";
import { readCard, scanQueries, type ScanQuery, type ScanReading } from "@/lib/scan/parse";

type Cam = "idle" | "starting" | "live" | "denied" | "unavailable";
type Phase = "aim" | "reading" | "searching" | "ai" | "results" | "nothing" | "error";

// OCR en el navegador (Tesseract). El motor y el idioma se descargan la primera vez y se reutilizan.
type OcrWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
let workerPromise: Promise<{ worker: OcrWorker; sparse: string }> | null = null;
const getWorker = () =>
  (workerPromise ??= import("tesseract.js").then(async ({ createWorker, PSM }) => ({
    worker: await createWorker("eng"),
    sparse: PSM.SPARSE_TEXT, // texto suelto: la franja de abajo mezcla código, número, ilustrador...
  })));

async function ocr(c: HTMLCanvasElement): Promise<string> {
  const { worker, sparse } = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: sparse as never });
  const { data } = await worker.recognize(c);
  return data.text;
}

// Prueba las búsquedas en orden y se queda con la primera que encuentra cartas. Devuelve también el
// código de colección que coincidió (si fue una búsqueda por código), para enseñarlo.
async function searchFirst(queries: ScanQuery[], signal: AbortSignal): Promise<{ cards: Card[]; code: string | null }> {
  for (const { q, set } of queries) {
    const r = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}${set ? "&set=1" : ""}`, { signal });
    if (!r.ok) continue;
    const d = (await r.json()) as { cards?: Card[] };
    if (d.cards?.length) return { cards: d.cards, code: set ? q.split(" ")[0] : null };
  }
  return { cards: [], code: null };
}

export function Scanner() {
  const { t: dict, path } = useI18n();
  const t = dict.scanner;
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef<AbortController | null>(null);
  const [cam, setCam] = useState<Cam>("idle");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [multiCam, setMultiCam] = useState(false);
  const [phase, setPhase] = useState<Phase>("aim");
  const [shot, setShot] = useState<string | null>(null); // captura de la carta (JPEG)
  const [reading, setReading] = useState<ScanReading | null>(null);
  const [results, setResults] = useState<Card[]>([]);
  const [hitCode, setHitCode] = useState<string | null>(null); // código que coincidió con una colección
  const [viaAi, setViaAi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busy = phase === "reading" || phase === "searching" || phase === "ai";

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };
  useEffect(
    () => () => {
      stopCamera();
      runRef.current?.abort();
    },
    [],
  );

  async function startCamera(f = facing) {
    if (!navigator.mediaDevices?.getUserMedia) return setCam("unavailable");
    setCam("starting");
    stopCamera();
    void getWorker(); // se va preparando el OCR mientras se abre la cámara
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: f }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setCam("live");
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMultiCam(devices.filter((d) => d.kind === "videoinput").length > 1);
    } catch (e) {
      const blocked = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      setCam(blocked ? "denied" : "unavailable");
    }
  }

  function capture() {
    const v = videoRef.current, f = frameRef.current, b = stageRef.current;
    if (!v || !f || !b || cam !== "live" || busy) return;
    void analyze(cropFromVideo(v, f.getBoundingClientRect(), b.getBoundingClientRect()));
  }

  function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      void analyze(cropFromImage(img));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // Captura -> OCR de las dos franjas -> búsquedas en orden de precisión
  async function analyze(card: HTMLCanvasElement) {
    runRef.current?.abort();
    const ctl = (runRef.current = new AbortController());
    setShot(card.toDataURL("image/jpeg", 0.85));
    setResults([]);
    setHitCode(null);
    setReading(null);
    setViaAi(false);
    setMessage(null);
    setPhase("reading");
    try {
      // abajo-izquierda dos veces (umbral primero: acierta más el código), abajo-derecha (número en
      // cartas antiguas) y el nombre arriba
      const blThr = await ocr(region(card, 0, 0.5, 0.87, 0.97, "threshold"));
      const blGray = await ocr(region(card, 0, 0.5, 0.87, 0.97, "gray"));
      const br = await ocr(region(card, 0.5, 1, 0.91, 0.99, "gray"));
      const top = await ocr(region(card, 0.16, 0.79, 0.025, 0.1, "gray"));
      if (ctl.signal.aborted) return;
      const r = readCard([blThr, blGray, br], top);
      setReading(r);
      const queries = scanQueries(r);
      if (!queries.length) return setPhase("nothing");
      setPhase("searching");
      const found = await searchFirst(queries, ctl.signal);
      if (ctl.signal.aborted) return;
      setResults(found.cards);
      setHitCode(found.code);
      setPhase(found.cards.length ? "results" : "nothing");
    } catch {
      if (ctl.signal.aborted) return;
      setMessage(t.ocrFailed);
      setPhase("error");
    }
  }

  // Segunda opinión: la foto va a la IA de Claude (servidor) y se busca con lo que devuelve
  async function askAi() {
    if (!shot) return;
    runRef.current?.abort();
    const ctl = (runRef.current = new AbortController());
    setPhase("ai");
    setMessage(null);
    try {
      const res = await fetch("/api/scan/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: shot.split(",")[1] }),
        signal: ctl.signal,
      });
      if (res.status === 503) throw new Error(t.aiUnavailable);
      if (res.status === 429) throw new Error(t.aiRate);
      if (!res.ok) throw new Error(t.aiFailed);
      const id = (await res.json()) as { isCard: boolean; name: string; setCode: string; number: string };
      if (!id.isCard) throw new Error(t.notACard);
      const code = id.setCode || null;
      const r: ScanReading = { setCode: code, setCodes: code ? [code] : [], number: id.number || null, total: null, name: id.name || null };
      setReading(r);
      setViaAi(true);
      setPhase("searching");
      const found = await searchFirst(scanQueries(r), ctl.signal);
      if (ctl.signal.aborted) return;
      setResults(found.cards);
      setHitCode(found.code);
      setPhase(found.cards.length ? "results" : "nothing");
    } catch (e) {
      if (ctl.signal.aborted) return;
      setMessage(e instanceof Error && e.message ? e.message : t.aiFailed);
      setPhase("error");
    }
  }

  // Confirmada: la captura viaja al visor como "Tu escaneo" y se abre la carta con sus precios
  function choose(c: Card) {
    try {
      if (shot) sessionStorage.setItem(`slab:scan:${c.id}`, shot);
    } catch {
      /* sin almacenamiento: se abre la carta sin la captura */
    }
    stopCamera();
    router.push(path(`/?card=${encodeURIComponent(c.id)}`));
  }

  function reset() {
    runRef.current?.abort();
    setPhase("aim");
    setShot(null);
    setReading(null);
    setResults([]);
    setHitCode(null);
    setMessage(null);
    setViaAi(false);
  }

  return (
    <section className="mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-8 px-4 pb-20 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-12 md:px-10">
      {/* ---- Cámara ---- */}
      <div>
        <div
          ref={stageRef}
          aria-label={t.stageLabel}
          className="relative mx-auto aspect-[4/5] w-[min(100%,calc(72dvh*0.8))] overflow-hidden rounded-2xl bg-[#0e1116] text-[#e7ebf0]"
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover ${cam === "live" ? "" : "invisible"}`}
          />
          {cam === "live" && <Guide frameRef={frameRef} scanning={busy} />}
          {/* sin cámara pero con una foto subida: se enseña la carta escaneada */}
          {cam !== "live" && shot && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- captura local (data URL), no hay nada que optimizar */}
              <img src={shot} alt={t.captured} className="absolute inset-0 h-full w-full object-contain p-6" />
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-[linear-gradient(to_top,rgb(14_17_22/0.95),transparent)] px-4 pb-4 pt-10">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#e7ebf0] px-4 text-[14px] font-semibold text-[#13171c] transition-transform duration-200 active:scale-[0.97]"
                >
                  <CameraIcon size={17} weight="bold" aria-hidden />
                  {t.startCamera}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-[14px] font-semibold transition-[background-color,transform] duration-200 hover:bg-white/15 active:scale-[0.97]"
                >
                  <UploadSimpleIcon size={17} weight="bold" aria-hidden />
                  {t.upload}
                </button>
              </div>
            </>
          )}
          {cam !== "live" && !shot && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center">
              {cam === "starting" ? (
                <p className="inline-flex items-center gap-2 text-[15px] text-[#c3cad3]">
                  <CircleNotchIcon size={18} className="animate-spin motion-reduce:animate-none" aria-hidden />
                  {t.starting}
                </p>
              ) : (
                <div className="flex max-w-[34ch] flex-col items-center gap-4">
                  <span className="grid size-14 place-items-center rounded-full bg-white/10">
                    {cam === "idle" ? <CameraIcon size={26} aria-hidden /> : <WarningCircleIcon size={26} aria-hidden />}
                  </span>
                  <p className="text-[19px] font-bold leading-snug tracking-[-0.01em]">
                    {cam === "idle" ? t.startTitle : cam === "denied" ? t.deniedTitle : t.unavailableTitle}
                  </p>
                  <p className="text-[14.5px] leading-relaxed text-[#aab3be]">
                    {cam === "idle" ? t.startText : cam === "denied" ? t.deniedText : t.unavailableText}
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {cam !== "unavailable" && (
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#e7ebf0] px-5 font-semibold text-[#13171c] transition-transform duration-200 active:scale-[0.97]"
                      >
                        <CameraIcon size={18} weight="bold" aria-hidden />
                        {t.startCamera}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-5 font-semibold transition-[background-color,transform] duration-200 hover:bg-white/15 active:scale-[0.97]"
                    >
                      <UploadSimpleIcon size={18} weight="bold" aria-hidden />
                      {t.upload}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {cam === "live" && (
          <div className="mt-5 flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title={t.upload}
              aria-label={t.upload}
              className="grid size-12 place-items-center rounded-full bg-panel text-muted transition-[color,transform] duration-200 hover:text-ink active:scale-[0.94]"
            >
              <UploadSimpleIcon size={20} aria-hidden />
            </button>
            <button
              type="button"
              onClick={capture}
              disabled={busy}
              aria-label={t.shutter}
              className="group grid size-[72px] place-items-center rounded-full bg-ink p-1.5 transition-transform duration-200 active:scale-[0.95] disabled:opacity-50"
            >
              <span className="grid size-full place-items-center rounded-full border-2 border-panel text-panel">
                {busy ? (
                  <CircleNotchIcon size={24} className="animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <ScanIcon size={26} weight="bold" aria-hidden />
                )}
              </span>
            </button>
            {multiCam ? (
              <button
                type="button"
                onClick={() => {
                  const f = facing === "environment" ? "user" : "environment";
                  setFacing(f);
                  void startCamera(f);
                }}
                title={t.switchCamera}
                aria-label={t.switchCamera}
                className="grid size-12 place-items-center rounded-full bg-panel text-muted transition-[color,transform] duration-200 hover:text-ink active:scale-[0.94]"
              >
                <CameraRotateIcon size={20} aria-hidden />
              </button>
            ) : (
              <span className="size-12" aria-hidden />
            )}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="vh"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {/* ---- Panel de resultado ---- */}
      <aside aria-live="polite" className="rounded-2xl bg-panel p-6 md:p-8">
        {phase === "aim" && (
          <>
            <h2 className="text-[22px]! font-bold! tracking-[-0.015em]! [font-stretch:110%]">{t.tipsTitle}</h2>
            <ul className="mt-6 flex flex-col gap-5">
              {[FrameCornersIcon, SunIcon, HashIcon].map((Icon, i) => (
                <li key={i} className="flex items-start gap-3.5 text-[15px] leading-relaxed">
                  <Icon size={22} className="mt-0.5 flex-none text-accent" aria-hidden />
                  <span>{t.tips[i]}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {phase !== "aim" && (
          <div className="flex items-start gap-5">
            {shot && (
              <Image
                src={shot}
                alt={t.captured}
                width={96}
                height={134}
                unoptimized
                className="h-[134px] w-24 flex-none rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              {busy ? (
                <ol className="flex flex-col gap-3 pt-1 text-[15px]">
                  {(viaAi || phase === "ai" ? [t.stepAi, t.stepSearch] : [t.stepRead, t.stepSearch]).map((label, i) => {
                    const activeIdx = phase === "searching" ? 1 : 0;
                    const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
                    return (
                      <li key={label} className={`flex items-center gap-2.5 ${state === "todo" ? "text-muted" : ""}`}>
                        {state === "done" ? (
                          <CheckIcon size={18} weight="bold" className="text-up" aria-hidden />
                        ) : state === "active" ? (
                          <CircleNotchIcon size={18} className="animate-spin text-accent motion-reduce:animate-none" aria-hidden />
                        ) : (
                          <span className="mx-[5px] size-2 rounded-full bg-line" aria-hidden />
                        )}
                        {label}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <Reading reading={reading} code={hitCode} viaAi={viaAi} />
              )}
            </div>
          </div>
        )}

        {phase === "results" && (
          <div className="mt-7">
            <h2 className="text-[18px]! font-bold! tracking-[-0.01em]!">{t.resultsTitle}</h2>
            <ul className="mt-3 flex flex-col">
              {results.map((c, i) => (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 26, delay: i * 0.04 }}
                  className="border-t border-line first:border-t-0"
                >
                  <button
                    type="button"
                    onClick={() => choose(c)}
                    className="group flex w-full items-center gap-3 py-3 text-left"
                  >
                    <span className="block h-[50px] w-9 flex-none overflow-hidden rounded bg-soft">
                      {c.imageThumbUrl && (
                        <Image src={c.imageThumbUrl} alt="" width={36} height={50} unoptimized className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="font-semibold">{c.name}</b>
                      <span className="truncate text-[13px] text-muted">{metaLine(c)}</span>
                    </span>
                    <span className="inline-flex flex-none items-center gap-1.5 rounded-lg bg-soft px-3 py-2 text-[13px] font-semibold transition-colors duration-200 group-hover:bg-ink group-hover:text-panel">
                      {t.confirm}
                      <ArrowRightIcon size={14} weight="bold" aria-hidden />
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
            <Actions>
              {!viaAi && <AiButton onClick={askAi} label={t.noneMatch} />}
              <RetryButton onClick={reset} label={t.retry} />
            </Actions>
          </div>
        )}

        {(phase === "nothing" || phase === "error") && (
          <div className="mt-7">
            <p className="flex items-start gap-2.5 text-[15px] leading-relaxed">
              <WarningCircleIcon size={20} weight="fill" className="mt-0.5 flex-none text-down" aria-hidden />
              {message ?? t.noResults}
            </p>
            {/* sin clave de la API no tiene sentido volver a ofrecer la IA */}
            {!viaAi && message !== t.ocrFailed && message !== t.aiUnavailable && (
              <p className="mt-4 max-w-[52ch] text-[14px] leading-relaxed text-muted">{t.askAiHint}</p>
            )}
            <Actions>
              {!viaAi && message !== t.aiUnavailable && <AiButton onClick={askAi} label={t.askAi} primary />}
              <RetryButton onClick={reset} label={t.retry} />
            </Actions>
          </div>
        )}
      </aside>
    </section>
  );
}

// Marco guía con la proporción de una carta: oscurece lo de fuera y marca dónde están el nombre y el
// código. Mientras se lee, una línea de luz recorre la carta.
function Guide({ frameRef, scanning }: { frameRef: React.RefObject<HTMLDivElement | null>; scanning: boolean }) {
  const { t: dict } = useI18n();
  const t = dict.scanner;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div
        ref={frameRef}
        className="relative aspect-[63/88] h-[84%] rounded-[14px] border border-white/70 shadow-[0_0_0_9999px_rgb(8_10_14/0.55)]"
      >
        {/* esquinas */}
        {["left-[-2px] top-[-2px] border-l-[3px] border-t-[3px] rounded-tl-[14px]", "right-[-2px] top-[-2px] border-r-[3px] border-t-[3px] rounded-tr-[14px]",
          "left-[-2px] bottom-[-2px] border-l-[3px] border-b-[3px] rounded-bl-[14px]", "right-[-2px] bottom-[-2px] border-r-[3px] border-b-[3px] rounded-br-[14px]"].map((c) => (
          <span key={c} className={`absolute size-7 border-white ${c}`} />
        ))}
        {/* zonas que lee el OCR */}
        <span className="absolute inset-x-0 top-[13%] border-t border-dashed border-white/45" />
        <span className="absolute left-2 top-[3%] text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">{t.zoneName}</span>
        <span className="absolute inset-x-0 top-[86%] border-t border-dashed border-white/45" />
        <span className="absolute bottom-[2.5%] left-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">{t.zoneCode}</span>
        {scanning && (
          <motion.span
            className="absolute inset-x-0 h-16 bg-[linear-gradient(to_bottom,transparent,rgb(255_255_255/0.28),transparent)]"
            initial={{ top: "-10%" }}
            animate={{ top: ["-10%", "95%"] }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 0.15 }}
          />
        )}
      </div>
    </div>
  );
}

// Lo que se ha leído, para que se entienda por qué salen esos resultados. El código solo se enseña si
// coincidió con una colección real (los demás candidatos del OCR suelen ser ruido).
function Reading({ reading, code, viaAi }: { reading: ScanReading | null; code: string | null; viaAi: boolean }) {
  const { t: dict } = useI18n();
  const t = dict.scanner;
  const items = reading
    ? ([
        [t.readCode, code],
        [t.readNumber, reading.number ? `${reading.number}${reading.total ? `/${reading.total}` : ""}` : null],
        [t.readName, reading.name],
      ] as const).filter(([, v]) => v)
    : [];
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-muted">
        {t.readTitle}
        {viaAi && (
          <span className="inline-flex items-center gap-1 rounded-md bg-soft px-1.5 py-0.5 text-ink">
            <MagicWandIcon size={13} aria-hidden />
            {t.viaAi}
          </span>
        )}
      </p>
      {items.length ? (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
          {items.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-[15px]">{t.nothingRead}</p>
      )}
    </div>
  );
}

const Actions = ({ children }: { children: ReactNode }) => <div className="mt-6 flex flex-wrap gap-2">{children}</div>;

function AiButton({ onClick, label, primary }: { onClick: () => void; label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold transition-transform duration-200 active:scale-[0.97] ${
        primary ? "bg-ink text-panel" : "bg-soft"
      }`}
    >
      <MagicWandIcon size={18} aria-hidden />
      {label}
    </button>
  );
}

function RetryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold text-muted transition-[color,transform] duration-200 hover:text-ink active:scale-[0.97]"
    >
      <ArrowCounterClockwiseIcon size={18} aria-hidden />
      {label}
    </button>
  );
}

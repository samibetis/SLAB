"use client";

import { BookBookmarkIcon, CircleNotchIcon, FolderSimplePlusIcon, MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SetInfo } from "@/lib/catalog/types";
import { cardImage, newId } from "@/lib/collection/logic";
import { browserStore } from "@/lib/collection/store";
import type { Album } from "@/lib/collection/types";
import { PRESETS, presetOf, type Preset } from "@/lib/collection/versions";
import { es } from "@/lib/i18n/es";
import { BackupControls } from "../BackupControls";
import { TrackingPicker } from "./TrackingPicker";
import { useAlbums } from "./useAlbums";

// Portada de la colección: crear (master set o álbum libre) a la izquierda y tus álbumes a la derecha.
export function CollectionHome() {
  const t = es.collection;
  const router = useRouter();
  const { albums, error } = useAlbums();
  const [q, setQ] = useState("");
  const [sets, setSets] = useState<SetInfo[] | null>(null);
  const [setsState, setSetsState] = useState<"idle" | "loading" | "error">("idle");
  const [freeName, setFreeName] = useState("");
  const [preset, setPreset] = useState<Preset>("all"); // tipo del próximo master set
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    ctl.current?.abort();
  }, []);

  // Búsqueda de colecciones con espera de 250 ms entre teclas
  function onQuery(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    ctl.current?.abort();
    if (v.trim().length < 2) {
      setSets(null);
      setSetsState("idle");
      return;
    }
    timer.current = setTimeout(async () => {
      const c = (ctl.current = new AbortController());
      setSetsState("loading");
      try {
        const r = await fetch(`/api/sets?q=${encodeURIComponent(v.trim())}`, { signal: c.signal });
        if (!r.ok) throw new Error();
        setSets(((await r.json()) as { sets: SetInfo[] }).sets);
        setSetsState("idle");
      } catch {
        if (!c.signal.aborted) setSetsState("error");
      }
    }, 250);
  }

  async function create(album: Album) {
    try {
      await browserStore.save(album);
      router.push(`/coleccion/${album.id}`);
    } catch {
      alert(t.storageError);
    }
  }

  const now = () => new Date().toISOString();
  const createMaster = (s: SetInfo) =>
    create({
      id: newId(), name: s.name, kind: "master", entries: [], createdAt: now(), updatedAt: now(),
      set: { key: s.key, id: s.id, language: s.language, name: s.name, code: s.code },
      tracking: PRESETS[preset],
    });
  const createFree = () => {
    const name = freeName.trim();
    if (name) void create({ id: newId(), name, kind: "free", entries: [], createdAt: now(), updatedAt: now() });
  };

  return (
    <section className="mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-10 px-4 pb-20 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-14 md:px-10">
      {/* ---- Crear ---- */}
      <div className="flex flex-col gap-8 md:sticky md:top-6">
        <div className="rounded-2xl bg-panel p-6">
          <h2 className="flex items-center gap-2 text-[20px]! font-bold! tracking-[-0.015em]!">
            <BookBookmarkIcon size={22} className="text-accent" aria-hidden />
            {t.newMaster}
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t.newMasterHint}</p>
          <div className="mt-4">
            <TrackingPicker value={preset} onChange={setPreset} />
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-bg/40 px-3 transition-colors duration-200 focus-within:border-ink">
            <MagnifyingGlassIcon size={18} className="text-muted" aria-hidden />
            <span className="vh">{t.newMaster}</span>
            <input
              value={q}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={t.setPlaceholder}
              className="min-w-0 flex-1 bg-transparent py-3 text-[15.5px] outline-none placeholder:text-muted"
            />
            {setsState === "loading" && <CircleNotchIcon size={16} className="animate-spin text-muted motion-reduce:animate-none" aria-hidden />}
          </label>
          <div aria-live="polite">
            {setsState === "error" && <p className="mt-3 text-[14px] text-down">{t.setsError}</p>}
            {sets && !sets.length && setsState === "idle" && <p className="mt-3 text-[14px] text-muted">{t.noSets}</p>}
            {sets && sets.length > 0 && (
              <ul className="mt-2 flex flex-col">
                {sets.map((s) => (
                  <li key={s.key} className="border-t border-line first:border-t-0">
                    <button
                      type="button"
                      onClick={() => createMaster(s)}
                      className="group flex w-full items-center gap-3 py-2.5 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <b className="block truncate font-semibold">{s.name}</b>
                        <span className="text-[12.5px] text-muted">
                          {[s.code, s.language === "JP" ? "japonés" : "inglés", s.releaseDate?.slice(0, 4)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="inline-flex flex-none items-center gap-1 rounded-lg bg-soft px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors duration-200 group-hover:bg-ink group-hover:text-panel">
                        <PlusIcon size={13} weight="bold" aria-hidden />
                        {t.create}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <form
          className="rounded-2xl bg-panel p-6"
          onSubmit={(e) => {
            e.preventDefault();
            createFree();
          }}
        >
          <h2 className="flex items-center gap-2 text-[20px]! font-bold! tracking-[-0.015em]!">
            <FolderSimplePlusIcon size={22} className="text-accent" aria-hidden />
            {t.newFree}
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t.newFreeHint}</p>
          <div className="mt-4 flex gap-2">
            <label className="vh" htmlFor="free-name">{t.freePlaceholder}</label>
            <input
              id="free-name"
              value={freeName}
              onChange={(e) => setFreeName(e.target.value)}
              placeholder={t.freePlaceholder}
              maxLength={60}
              className="min-w-0 flex-1 rounded-xl border border-line bg-bg/40 px-3 py-3 text-[15.5px] outline-none transition-colors duration-200 placeholder:text-muted focus:border-ink"
            />
            <button
              type="submit"
              disabled={!freeName.trim()}
              className="rounded-xl bg-ink px-4 font-semibold text-panel transition-[opacity,transform] duration-200 active:scale-[0.97] disabled:opacity-40"
            >
              {t.createFree}
            </button>
          </div>
        </form>
        <p className="text-[13px] leading-relaxed text-muted">{t.localNote}</p>
        <BackupControls />
      </div>

      {/* ---- Álbumes ---- */}
      <div>
        <h2 className="text-[clamp(24px,2.4vw,32px)]! tracking-[-0.02em]!">{t.albumsTitle}</h2>
        {error && <p className="mt-6 text-down">{t.storageError}</p>}
        {!albums && !error && (
          <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[188px] rounded-2xl" />)}
          </div>
        )}
        {albums && !albums.length && (
          <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <BookBookmarkIcon size={34} className="mx-auto text-muted" aria-hidden />
            <p className="mt-4 text-[18px] font-bold tracking-[-0.01em]">{t.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-[44ch] text-[14.5px] leading-relaxed text-muted">{t.emptyText}</p>
          </div>
        )}
        {albums && albums.length > 0 && (
          <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
            {albums.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 26, delay: i * 0.04 }}
              >
                <AlbumCover album={a} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// Tapa de un álbum: lomo oscuro, nombre, tipo y progreso, con las últimas cartas añadidas en abanico.
function AlbumCover({ album }: { album: Album }) {
  const t = es.collection;
  // Las 3 últimas cartas distintas: una carta puede tener varias entradas (una por versión, p. ej.
  // normal y reverse) y no debe salir repetida en el abanico (ni repetir la key de React).
  const recent = [...new Map([...album.entries].reverse().map((e) => [e.card.id, e] as const)).values()].slice(0, 3);
  // master set: el progreso guardado al abrirlo (en cartas o versiones según su tipo)
  const stats = album.stats;
  const owned = stats?.owned ?? new Set(album.entries.map((e) => e.card.id)).size;
  const total = stats?.total ?? album.total;
  return (
    <Link
      href={`/coleccion/${album.id}`}
      // altura mínima, no fija: si el nombre ocupa dos líneas la tapa crece en vez de pisar el progreso
      className="group relative flex min-h-[188px] overflow-hidden rounded-2xl bg-panel transition-transform duration-300 ease-out-expo hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <span aria-hidden className="w-3 flex-none bg-ink" />
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <div className="min-w-0">
          {/* tipo en una sola línea (recortado si no cabe; completo al pasar el ratón) */}
          <span
            className="block truncate text-[12px] font-semibold uppercase tracking-[0.06em] text-muted"
            title={album.kind === "master" ? t.presets[presetOf(album.tracking)].name : t.free}
          >
            {[album.set?.code, album.kind === "master" ? t.presets[presetOf(album.tracking)].name : t.free].filter(Boolean).join(" · ")}
          </span>
          <b className="mt-1 line-clamp-3 text-balance text-[18px] font-bold leading-tight tracking-[-0.015em]" title={album.name}>
            {album.name}
          </b>
        </div>
        <div className="mt-auto">
          {album.kind === "master" && total ? (
            <>
              <p className="text-[13px] font-semibold tabular-nums text-muted">
                {stats?.unit === "versions" ? t.progressVersions(owned, total) : t.progressCards(owned, total)}
              </p>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-soft">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (owned / total) * 100)}%` }} />
              </span>
            </>
          ) : (
            <p className="text-[13px] font-semibold tabular-nums text-muted">{t.cardsCount(album.entries.length)}</p>
          )}
        </div>
      </div>
      {recent.length > 0 && (
        <div aria-hidden className="relative w-[96px] flex-none">
          {recent.map((e, i) => {
            const src = cardImage(e.card);
            return src ? (
              // eslint-disable-next-line @next/next/no-img-element -- miniaturas pequeñas de TCGdex
              <img
                key={e.card.id}
                src={src}
                alt=""
                className="absolute top-1/2 h-[118px] w-[84px] rounded-[5px] object-cover shadow-[0_6px_14px_-6px_rgb(var(--shadow-tint)/0.5)] transition-transform duration-300 ease-out-expo group-hover:rotate-0"
                style={{ right: 12 + i * 10, transform: `translateY(-50%) rotate(${(i - 1) * 7}deg)`, zIndex: 3 - i }}
              />
            ) : null;
          })}
        </div>
      )}
    </Link>
  );
}

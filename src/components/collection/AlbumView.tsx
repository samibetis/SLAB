"use client";

import { ArrowLeftIcon, BookOpenIcon, MagnifyingGlassIcon, SquaresFourIcon, TrashIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { byNumber, entryId } from "@/lib/collection/logic";
import { browserStore } from "@/lib/collection/store";
import type { Album, AlbumEntry, SetCard } from "@/lib/collection/types";
import { PRESETS, cardStatus, countsVersions, presetOf, setProgress, toggleVersion, toggleWhole, type Preset } from "@/lib/collection/versions";
import { useI18n } from "@/components/I18nProvider";
import { langName } from "@/lib/cards/format";
import { Binder } from "./Binder";
import { FreePocket, MasterPocket } from "./Pocket";
import { TrackingPicker } from "./TrackingPicker";

type Filter = "all" | "missing" | "owned";

// Progreso guardado en el álbum para su portada en /coleccion
function withStats(a: Album, setCards: SetCard[] | null): Album {
  if (a.kind !== "master" || !setCards) return a;
  const p = setProgress(a, setCards);
  const stats = { owned: p.owned, total: p.total, unit: p.unit };
  const same = a.stats && a.stats.owned === stats.owned && a.stats.total === stats.total && a.stats.unit === stats.unit;
  return same && a.total === setCards.length ? a : { ...a, stats, total: setCards.length };
}

// Un álbum: cabecera con progreso, carpeta 3D o cuadrícula.
//  - Master set: las cartas salen de la colección completa (API, con sus versiones); cada carta ocupa
//    un bolsillo y se marcan las versiones que tienes. El tipo de master set decide qué cuenta.
//  - Álbum libre: solo lo que has añadido, un bolsillo por versión.
export function AlbumView({ id }: { id: string }) {
  const { t: dict, path } = useI18n();
  const t = dict.collection;
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null | undefined>(undefined); // undefined = cargando
  const [setCards, setSetCards] = useState<SetCard[] | null>(null);
  const [setError, setSetError] = useState(false);
  const [view, setView] = useState<"binder" | "grid">("binder");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    browserStore.get(id).then((a) => alive && setAlbum(a)).catch(() => alive && setAlbum(null));
    return () => {
      alive = false;
    };
  }, [id]);

  // Cambios del álbum: se aplican sobre el estado más reciente (varios seguidos, como "Todas", no se
  // pisan) y se guardan con el progreso actualizado.
  function update(fn: (a: Album) => Album) {
    setAlbum((prev) => {
      if (!prev) return prev;
      const next = withStats(fn(prev), setCards);
      void browserStore.save(next).catch(() => alert(t.storageError));
      return next;
    });
  }

  // Master set: lista completa de la colección con las versiones de cada carta.
  const setKey = album?.kind === "master" ? album.set?.key : undefined;
  useEffect(() => {
    if (!setKey) return;
    const ctl = new AbortController();
    fetch(`/api/sets/${encodeURIComponent(setKey)}/cards`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ cards: SetCard[] }>) : Promise.reject()))
      .then(({ cards }) => {
        setSetCards(cards);
        setAlbum((a) => {
          if (!a) return a;
          const next = withStats(a, cards);
          if (next !== a) void browserStore.save(next).catch(() => {});
          return next;
        });
      })
      .catch(() => !ctl.signal.aborted && setSetError(true));
    return () => ctl.abort();
  }, [setKey]);

  const isMaster = album?.kind === "master";
  const statuses = useMemo(
    () => new Map(album && setCards ? setCards.map((c) => [c.id, cardStatus(album, c)]) : []),
    [album, setCards],
  );
  // Álbum libre: un bolsillo por versión, en orden de colección
  const entries = useMemo(
    () => [...(album?.entries ?? [])].sort((a, b) => byNumber(a.card, b.card) || (a.variant ?? "").localeCompare(b.variant ?? "")),
    [album],
  );

  if (album === undefined) {
    return <div className="mx-auto max-w-[1400px] px-4 md:px-10"><div className="skeleton h-[60vh] rounded-2xl" /></div>;
  }
  if (album === null) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16 text-center md:px-10">
        <p className="text-[18px] font-semibold">{t.notFound}</p>
        <Link href={path("/coleccion")} className="mt-4 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
          <ArrowLeftIcon size={16} aria-hidden /> {t.back}
        </Link>
      </div>
    );
  }

  const preset = presetOf(album.tracking);
  const versionsMode = countsVersions(album.tracking);
  const prog = isMaster && setCards ? setProgress(album, setCards) : null;
  const progText = prog ? (versionsMode ? t.progressVersions(prog.owned, prog.total) : t.progressCards(prog.owned, prog.total)) : "";
  const shownCards = (setCards ?? []).filter((c) => {
    if (filter === "all") return true;
    const s = statuses.get(c.id);
    return (filter === "owned") === !!s?.complete;
  });

  const masterPocket = (c: SetCard) => (
    <MasterPocket
      card={c}
      status={statuses.get(c.id) ?? cardStatus(album, c)}
      onWhole={(card) => update((a) => toggleWhole(a, card))}
      onVersion={(card, key) => update((a) => toggleVersion(a, card, key))}
    />
  );

  const cover = (
    <div className="flex h-full flex-col justify-between rounded-l-[10px] bg-ink p-[7cqw] text-panel">
      <span className="text-[clamp(10px,2.4cqw,13px)] font-semibold uppercase tracking-[0.08em] opacity-70">
        {isMaster ? t.presets[preset].name : t.free}
      </span>
      <div>
        <p className="text-balance text-[clamp(20px,8cqw,46px)] font-extrabold leading-[0.95] tracking-[-0.03em] [font-stretch:125%]">
          {album.name}
        </p>
        {album.set && (
          <p className="mt-[2cqw] text-[clamp(11px,2.8cqw,15px)] opacity-70">
            {[album.set.code, langName(album.set.language, dict)].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      {prog ? (
        <div>
          <p className="text-[clamp(26px,9cqw,52px)] font-extrabold tabular-nums tracking-[-0.03em]">{Math.round(prog.ratio * 100)}%</p>
          <p className="text-[clamp(11px,2.6cqw,14px)] tabular-nums opacity-70">{progText}</p>
          {versionsMode && <p className="text-[clamp(11px,2.6cqw,14px)] tabular-nums opacity-70">{t.progressCards(prog.cards.owned, prog.cards.total)}</p>}
        </div>
      ) : (
        <p className="text-[clamp(11px,2.6cqw,14px)] opacity-70">{t.cardsCount(entries.length)}</p>
      )}
    </div>
  );

  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-20 md:px-10">
      {/* cabecera */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <Link href={path("/coleccion")} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted transition-colors duration-200 hover:text-ink">
            <ArrowLeftIcon size={15} aria-hidden /> {t.back}
          </Link>
          <h1 className="mt-3 text-balance text-[clamp(32px,4.2vw,56px)] font-extrabold leading-[0.95] tracking-[-0.03em] [font-stretch:125%]">
            {album.name}
          </h1>
          <p className="mt-3 text-[15px] text-muted">
            {[isMaster ? t.master : t.free, album.set?.code, album.set?.name !== album.name ? album.set?.name : null].filter(Boolean).join(" · ")}
          </p>
          {prog && (
            <div className="mt-4 max-w-[460px]">
              <div className="flex items-center gap-3">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-panel">
                  <span className="block h-full rounded-full bg-accent transition-[width] duration-500 ease-out-expo" style={{ width: `${prog.ratio * 100}%` }} />
                </span>
                <span className="text-[14px] font-semibold tabular-nums">{progText}</span>
              </div>
              {versionsMode && <p className="mt-1.5 text-[13px] tabular-nums text-muted">{t.progressCards(prog.cards.owned, prog.cards.total)}</p>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label={t.viewLabel} className="inline-flex rounded-xl bg-panel p-1">
            {(["binder", "grid"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold text-muted transition-colors duration-200 aria-pressed:bg-ink aria-pressed:text-panel"
              >
                {v === "binder" ? <BookOpenIcon size={16} aria-hidden /> : <SquaresFourIcon size={16} aria-hidden />}
                {v === "binder" ? t.viewBinder : t.viewGrid}
              </button>
            ))}
          </div>
          {confirmDelete ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-panel px-3 py-1.5 text-[13.5px]">
              {t.deleteConfirm}
              <button
                type="button"
                onClick={async () => {
                  await browserStore.remove(album.id).catch(() => {});
                  router.push(path("/coleccion"));
                }}
                className="rounded-lg bg-down px-2.5 py-1 font-semibold text-panel"
              >
                {t.deleteYes}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-1 font-semibold text-muted">
                {t.cancel}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-muted transition-colors duration-200 hover:text-down"
            >
              <TrashIcon size={16} aria-hidden /> {t.deleteAlbum}
            </button>
          )}
        </div>
      </div>

      {/* tipo de master set: cambiarlo solo cambia cómo se cuenta, lo marcado se conserva */}
      {isMaster && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span aria-hidden className="text-[13.5px] font-semibold text-muted">{t.trackingLabel}</span>
          <TrackingPicker compact value={preset} onChange={(p: Preset) => update((a) => ({ ...a, tracking: PRESETS[p], updatedAt: new Date().toISOString() }))} />
          <span className="text-[13px] text-muted">{t.presets[preset].hint}</span>
        </div>
      )}

      {/* contenido */}
      <div className="mt-10">
        {isMaster && setError && <p className="text-down">{t.setError}</p>}
        {isMaster && !setCards && !setError && (
          <div className="flex flex-col items-center gap-3">
            <div className="skeleton aspect-[3/2] w-full max-w-[1080px] rounded-2xl" />
            <p className="text-[14px] text-muted">{t.loadingVersions}</p>
          </div>
        )}
        {!isMaster && entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <p className="text-[16px]">{t.freeEmpty}</p>
            <Link href={path("/")} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 font-semibold text-panel">
              <MagnifyingGlassIcon size={16} aria-hidden /> {t.freeEmptyCta}
            </Link>
          </div>
        )}
        {(isMaster ? !!setCards : entries.length > 0) &&
          (view === "binder" ? (
            <>
              {isMaster ? (
                <Binder items={setCards!} itemKey={(c) => c.id} renderItem={masterPocket} cover={cover} />
              ) : (
                <Binder items={entries} itemKey={entryId} renderItem={(e: AlbumEntry) => <FreePocket entry={e} />} cover={cover} />
              )}
              {isMaster && <p className="mt-4 text-center text-[13px] text-muted">{versionsMode ? t.versionsHint : t.toggleHint}</p>}
            </>
          ) : (
            <>
              {isMaster && (
                <div role="group" aria-label={t.filterLabel} className="mb-6 inline-flex rounded-xl bg-panel p-1">
                  {(["all", "missing", "owned"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={filter === f}
                      onClick={() => setFilter(f)}
                      className="rounded-lg px-3 py-2 text-[13.5px] font-semibold text-muted transition-colors duration-200 aria-pressed:bg-ink aria-pressed:text-panel"
                    >
                      {f === "all" ? t.filterAll : f === "missing" ? t.filterMissing : versionsMode ? t.filterComplete : t.filterOwned}
                    </button>
                  ))}
                </div>
              )}
              <div className="@container grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3">
                {isMaster
                  ? shownCards.map((c) => <div key={c.id}>{masterPocket(c)}</div>)
                  : entries.map((e) => <FreePocket key={entryId(e)} entry={e} />)}
              </div>
            </>
          ))}
      </div>
    </section>
  );
}

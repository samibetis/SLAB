"use client";

import { ArrowDownRightIcon, ArrowSquareOutIcon, ArrowUpRightIcon, CheckIcon, CurrencyDollarIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { metaLine, variantLabel } from "@/lib/cards/format";
import { DEFAULT_VARIANT, type Card } from "@/lib/cards/types";
import { cardHref, newId, toAlbumCard } from "@/lib/collection/logic";
import { GRADERS, gradeOption } from "@/lib/grading/companies";
import { es } from "@/lib/i18n/es";
import { marketChange, parseAmount, summarize, timeline, type HoldingStat } from "@/lib/portfolio/logic";
import { portfolioStore } from "@/lib/portfolio/store";
import type { Holding } from "@/lib/portfolio/types";
import { money, monthLong, pct } from "@/lib/prices/format";
import { DEFAULT_RANGE, RANGES, type RangeKey } from "@/lib/prices/ranges";
import { SupportNote } from "../SupportNote";
import { Dialog } from "../ui/Dialog";
import { CardPicker } from "./CardPicker";
import { HoldingForm } from "./HoldingForm";
import { AnimatedMoney } from "./AnimatedMoney";
import { PortfolioChart } from "./PortfolioChart";
import { Showcase } from "./Showcase";
import { SlabThumb } from "./SlabThumb";
import { saveSlabValue } from "./slabValue";
import { usePortfolio } from "./usePortfolio";

type Sort = "value" | "pnl" | "recent";
type Editing = { mode: "add"; card: Card | null } | { mode: "edit"; h: Holding } | null;
const CUR = "USD";
const EASE = [0.16, 1, 0.3, 1] as const;

const gradeText = (h: Pick<Holding, "grader" | "gradeId">) => {
  const o = gradeOption(h.grader, h.gradeId);
  return `${h.grader} ${o.value} · ${o.word}`;
};
const dateText = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
const slabHref = (h: Holding) => `${cardHref(h.card)}&variant=${encodeURIComponent(h.variant)}&grader=${h.grader}&grade=${encodeURIComponent(h.gradeId)}`;
const INTRO_KEY = "slab:portfolio:intro";
const save = (h: Holding) => portfolioStore.save(h).catch(() => alert(es.portfolio.storageError));

// Portafolio de gradeadas: valor de hoy frente a lo pagado, evolución mes a mes, reparto por empresa y
// la lista de slabs. Los slabs viven en el navegador; los precios llegan del servidor en una petición.
export function PortfolioView() {
  const t = es.portfolio;
  const { holdings, fresh, storeError, status, series, manualCount, sources, csv, retry } = usePortfolio();
  // La entrada completa (reparto, revelado y cuenta del total) solo la primera vez en la sesión:
  // al volver a la página los datos se ven al instante, sin esperar a la coreografía.
  const [intro] = useState(() => {
    try {
      return !sessionStorage.getItem(INTRO_KEY);
    } catch {
      return false;
    }
  });
  const ready = !!holdings?.length && status !== "loading";
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {}
  }, [ready]);
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const [sort, setSort] = useState<Sort>("value");
  const [editing, setEditing] = useState<Editing>(null);

  const sum = useMemo(() => summarize(holdings ?? [], series), [holdings, series]);
  const line = useMemo(() => timeline(holdings ?? [], series), [holdings, series]);
  const n = RANGES.find((r) => r.k === range)!.n;
  const shownLine = isFinite(n) ? line.slice(-(n + 1)) : line;
  const market = useMemo(() => marketChange(holdings ?? [], series, n), [holdings, series, n]);
  const sorted = useMemo(() => {
    const s = [...sum.stats];
    if (sort === "value") s.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    if (sort === "pnl") s.sort((a, b) => (b.pnlPct ?? -Infinity) - (a.pnlPct ?? -Infinity));
    if (sort === "recent") s.sort((a, b) => b.h.addedAt.localeCompare(a.h.addedAt));
    return s;
  }, [sum.stats, sort]);

  // Cabecera: título y, si hay slabs, la vitrina con los de más valor
  const header = (aside?: ReactNode) => (
    <header className="mx-auto grid max-w-[1400px] items-center gap-6 px-4 pb-8 pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:gap-10 md:px-10 md:pb-10">
      <div>
        <h1 className="text-balance text-[clamp(34px,4.4vw,60px)] font-extrabold leading-[0.95] tracking-[-0.03em] [font-stretch:125%]">{t.title}</h1>
        <p className="mt-4 max-w-[52ch] text-[clamp(16px,1.25vw,18px)] leading-relaxed text-muted">{t.lead}</p>
      </div>
      {aside}
    </header>
  );
  // hueco de la vitrina mientras llegan los precios (para que la página no salte)
  const showcaseSpace = <div className="mx-auto aspect-[4/3] w-full max-w-[min(440px,100%)] md:w-[clamp(320px,32vw,460px)]" aria-hidden />;

  if (storeError) {
    return (
      <>
        {header()}
        <p className="mx-auto max-w-[1400px] px-4 text-down md:px-10">{t.storageError}</p>
      </>
    );
  }
  if (!holdings) {
    return (
      <>
      {header()}
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:px-10">
        <div className="flex flex-col gap-4"><div className="skeleton h-5 w-28 rounded" /><div className="skeleton h-20 w-4/5 rounded-xl" /><div className="skeleton h-5 w-2/3 rounded" /></div>
        <div className="skeleton h-[300px] rounded-2xl" />
      </div>
      </>
    );
  }

  const dialog = (
    <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.mode === "add" && !editing.card ? t.pickTitle : t.formTitle}>
      {editing?.mode === "add" && !editing.card && <CardPicker onPick={(c) => setEditing({ mode: "add", card: c })} />}
      {editing?.mode === "add" && editing.card && (
        <AddForm card={editing.card} onBack={() => setEditing({ mode: "add", card: null })} onDone={() => setEditing(null)} />
      )}
      {editing?.mode === "edit" && (
        <HoldingForm
          card={editing.h.card}
          meta={[editing.h.card.setName, editing.h.card.number ?? editing.h.card.localId].filter(Boolean).join(" · ")}
          initial={editing.h}
          submitLabel={t.save}
          onCancel={() => setEditing(null)}
          onSubmit={async ({ value, ...d }) => {
            const h = { ...editing.h, ...d, updatedAt: new Date().toISOString() };
            await save(h);
            if (value) await saveSlabValue(h, value).catch(() => alert(t.storageError));
            setEditing(null);
          }}
        />
      )}
    </Dialog>
  );

  if (!holdings.length) {
    return (
      <>
      {header()}
      <section className="mx-auto grid max-w-[1400px] items-center gap-12 px-4 pb-24 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:px-10">
        <div>
          <h2 className="text-[clamp(26px,2.8vw,36px)] font-extrabold leading-tight tracking-[-0.025em] [font-stretch:115%]">{t.emptyTitle}</h2>
          <p className="mt-3 max-w-[46ch] text-[16.5px] leading-relaxed text-muted">{t.emptyText}</p>
          <AddButton onClick={() => setEditing({ mode: "add", card: null })} className="mt-7" />
          <p className="mt-6 text-[13.5px] text-muted">{t.localNote}</p>
          <SupportNote compact className="mt-8" />
        </div>
        <EmptyStack />
        {dialog}
      </section>
      </>
    );
  }

  const asOf = line.at(-1)?.t;
  const synthetic = sources.some((s) => s.synthetic);
  const rawLabels = [...new Set(sources.map((s) => s.raw?.label).filter(Boolean))].join(" y ");
  // Proveedores de precios por nota de verdad (cuando haya API de pago): su fuente no es la del raw
  const paid = sources.filter((s) => !s.synthetic && s.label !== s.raw?.label).map((s) => s.label);
  const sourceText =
    (synthetic && asOf
      ? t.sourceMock(monthLong(asOf)) + (rawLabels ? t.sourceAnchored(rawLabels) : "")
      : paid.length && asOf
        ? t.sourceDb([...new Set(paid)].join(", "), monthLong(asOf))
        : t.sourceOwn(rawLabels)) +
    (manualCount ? t.sourceManual(manualCount) : "") +
    (csv ? t.sourceCsv : "");
  const up = sum.pnl >= 0;
  const pending = status === "loading" && !line.length; // primera carga de precios
  const figure = (v: ReactNode) => (pending ? <span className="skeleton inline-block h-[1.1em] w-[4.5ch] rounded align-middle" /> : v);
  const label = (s: HoldingStat) => `${s.h.card.name} ${s.h.grader} ${gradeOption(s.h.grader, s.h.gradeId).value}`;
  const reading =
    (sum.best ? t.readBest(label(sum.best), pct(sum.best.pnlPct)) : "") +
    (sum.worst ? t.readWorst(label(sum.worst), pct(sum.worst.pnlPct), (sum.worst.pnlPct ?? 0) >= 0) : "") +
    (sum.byGrader.length > 1 && sum.value > 0 ? t.readConcentration(sum.byGrader[0].grader, pct(sum.byGrader[0].share).replace("+", "")) : "");

  return (
    <>
    {header(ready ? <Showcase stats={sum.stats} play={intro} fresh={fresh} /> : showcaseSpace)}
    <section className="mx-auto max-w-[1400px] px-4 pb-24 md:px-10">
      {/* ---- resumen y evolución ---- */}
      <div className="grid items-start gap-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-14">
        <div className="@container">
          <p className="text-[14px] font-semibold text-muted">{t.valueLabel}</p>
          <p className="mt-1 whitespace-nowrap text-[clamp(34px,12.5cqw,88px)] font-extrabold leading-[0.92] tracking-[-0.035em] tabular-nums [font-stretch:125%]">
            {status === "loading" && !sum.value ? (
              <span className="skeleton inline-block h-[0.9em] w-[5ch] rounded-xl align-middle" />
            ) : (
              <AnimatedMoney value={sum.value} currency={CUR} from0={intro} />
            )}
          </p>
          {sum.cost > 0 && (
            <p className={`mt-4 inline-flex items-center gap-1.5 text-[19px] font-bold tabular-nums ${up ? "text-up" : "text-down"}`}>
              {up ? <ArrowUpRightIcon size={20} weight="bold" aria-hidden /> : <ArrowDownRightIcon size={20} weight="bold" aria-hidden />}
              <span className="vh">{t.pnlLabel}: </span>
              {(up ? "+" : "−") + money(Math.abs(sum.pnl), CUR)} · {pct(sum.pnlPct)}
            </p>
          )}
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-[14.5px]">
            <div>
              <dt className="text-muted">{t.costLabel}</dt>
              <dd className="mt-0.5 text-[17px] font-semibold tabular-nums">{figure(money(sum.cost, CUR))}</dd>
            </div>
            <div>
              <dt className="text-muted">{t.slabsLabel}</dt>
              <dd className="mt-0.5 text-[17px] font-semibold tabular-nums">{sum.count}</dd>
            </div>
            <div title={t.marketHint}>
              <dt className="text-muted">{t.marketLabel(range)}</dt>
              <dd className={`mt-0.5 text-[17px] font-semibold tabular-nums ${market == null ? "" : market >= 0 ? "text-up" : "text-down"}`}>{figure(pct(market))}</dd>
            </div>
          </dl>
          {!pending && sum.unpriced.count > 0 && <p className="mt-4 max-w-[52ch] text-[13.5px] text-muted">{t.unpriced(sum.unpriced.count, money(sum.unpriced.cost, CUR))}</p>}
          {!pending && reading && <p className="mt-6 max-w-[52ch] text-[16px] leading-relaxed">{reading}</p>}
          <AddButton onClick={() => setEditing({ mode: "add", card: null })} className="mt-7" />
        </div>

        <div className="rounded-3xl bg-panel p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-bold">{t.chartTitle}</h2>
              <p className="mt-1 flex items-center gap-4 text-[12.5px] text-muted">
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-ink" aria-hidden />{t.chartValue}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-[1.6px] border-dashed border-muted" aria-hidden />{t.chartCost}</span>
              </p>
            </div>
            <div role="group" aria-label={t.rangeLabel} className="inline-flex rounded-xl bg-soft p-1">
              {RANGES.map((r) => (
                <button
                  key={r.k}
                  type="button"
                  aria-pressed={range === r.k}
                  onClick={() => setRange(r.k)}
                  className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-muted transition-colors duration-150 aria-pressed:bg-panel aria-pressed:text-ink aria-pressed:shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.14)]"
                >
                  {r.k}
                </button>
              ))}
            </div>
          </div>
          {status === "error" ? (
            <div className="grid min-h-[220px] place-items-center text-center">
              <div>
                <p className="text-[15px] text-down">{t.pricesError}</p>
                <button type="button" onClick={retry} className="mt-3 rounded-xl bg-ink px-4 py-2 text-[14px] font-semibold text-panel">{t.retry}</button>
              </div>
            </div>
          ) : status === "loading" && !line.length ? (
            <div className="skeleton h-[260px] rounded-2xl" aria-label={t.loadingPrices} />
          ) : (
            <PortfolioChart points={shownLine} currency={CUR} />
          )}
        </div>
      </div>

      {/* ---- reparto y lista ---- */}
      <div className="mt-16 grid items-start gap-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-14">
        <div className="md:sticky md:top-6">
          <h2 className="text-[18px] font-bold">{t.byGrader}</h2>
          {sum.value > 0 && (
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-soft" aria-hidden>
              {sum.byGrader.filter((g) => g.value > 0).map((g, i) => (
                <motion.span
                  key={g.grader}
                  className="h-full origin-left first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${g.share * 100}%`, background: GRADERS[g.grader].swatch }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, delay: 0.15 + i * 0.09, ease: EASE }}
                />
              ))}
            </div>
          )}
          <ul className="mt-5 flex flex-col">
            {sum.byGrader.map((g) => (
              <li key={g.grader} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                <span className="size-3 shrink-0 rounded-[4px] ring-1 ring-ink/15" style={{ background: GRADERS[g.grader].swatch }} aria-hidden />
                <span className="w-12 font-bold">{g.grader}</span>
                <span className="min-w-0 flex-1 text-[13.5px] text-muted">{t.byGraderValue(pct(g.share).replace("+", ""), g.count)}</span>
                <span className="font-semibold tabular-nums">{money(g.value, CUR)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-bold">{t.holdingsTitle}</h2>
            <div role="group" aria-label={t.sortLabel} className="inline-flex rounded-xl bg-panel p-1">
              {(["value", "pnl", "recent"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={sort === s}
                  onClick={() => setSort(s)}
                  className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-muted transition-colors duration-150 aria-pressed:bg-ink aria-pressed:text-panel"
                >
                  {s === "value" ? t.sortValue : s === "pnl" ? t.sortPnl : t.sortRecent}
                </button>
              ))}
            </div>
          </div>
          <ul className="flex flex-col gap-2.5">
            {sorted.map((s) => (
              <HoldingRow key={s.h.id} s={s} fresh={fresh.has(s.h.id)} loading={status === "loading" && s.price == null && !!s.key} onEdit={() => setEditing({ mode: "edit", h: s.h })} />
            ))}
          </ul>
        </div>
      </div>

      {/* por qué los valores los pone el usuario, y cómo apoyar el proyecto */}
      <SupportNote compact className="mt-14" />
      <div className="mt-6 flex max-w-[90ch] flex-col gap-1 text-[13px] text-muted">
        <p>{sourceText}</p>
        <p>{t.localNote}</p>
      </div>
      {dialog}
    </section>
    </>
  );
}

function AddButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-12 items-center gap-2 rounded-2xl bg-ink px-5 text-[15px] font-semibold text-panel transition-transform duration-150 active:scale-[0.97] ${className}`}
    >
      <PlusIcon size={17} weight="bold" aria-hidden />
      {es.portfolio.add}
    </button>
  );
}

// Formulario de alta con la carta ya elegida: aquí sí se puede escoger la versión.
function AddForm({ card, onBack, onDone }: { card: Card; onBack: () => void; onDone: () => void }) {
  const t = es.portfolio;
  const variants = (card.variantOptions ?? []).map((v) => ({ key: v.key, label: variantLabel(v) }));
  return (
    <HoldingForm
      card={toAlbumCard(card)}
      meta={metaLine(card)}
      variants={variants.length ? variants : undefined}
      initial={{ grader: "PSA", gradeId: "10", variant: variants[0]?.key ?? DEFAULT_VARIANT }}
      submitLabel={t.saveNew}
      onCancel={onDone}
      aside={
        <button type="button" onClick={onBack} className="text-[13.5px] font-semibold underline underline-offset-4">
          {t.changeCard}
        </button>
      }
      onSubmit={async ({ value, ...d }) => {
        const now = new Date().toISOString();
        const h = { ...d, id: newId(), card: toAlbumCard(card), currency: CUR, addedAt: now, updatedAt: now };
        await save(h);
        if (value) await saveSlabValue(h, value).catch(() => alert(t.storageError));
        onDone();
      }}
    />
  );
}

// Una fila: la funda en miniatura, qué es, lo que pagaste y lo que vale, con su mini gráfica.
function HoldingRow({ s, fresh, loading, onEdit }: { s: HoldingStat; fresh: boolean; loading: boolean; onEdit: () => void }) {
  const t = es.portfolio;
  const [confirm, setConfirm] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const { h } = s;
  const up = (s.pnl ?? 0) >= 0;
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-2xl bg-panel p-3.5 sm:grid-cols-[64px_minmax(0,1fr)_auto]"
    >
      <Link href={slabHref(h)} aria-label={`${t.open}: ${h.card.name}`} className="row-span-2 self-start transition-transform duration-200 hover:-translate-y-0.5 sm:row-span-1">
        <SlabThumb card={h.card} grader={h.grader} gradeId={h.gradeId} reveal={fresh} delay={200} />
      </Link>
      <div className="min-w-0">
        <p className="truncate text-[16px] font-bold">{h.card.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13.5px] font-semibold">
          <span className="size-2 shrink-0 rounded-full ring-1 ring-ink/15" style={{ background: GRADERS[h.grader].swatch }} aria-hidden />
          {gradeText(h)}
          {h.cert && <span className="truncate font-normal text-muted">· {t.cert(h.cert)}</span>}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-muted">
          {[h.card.setName, h.card.number ?? h.card.localId, h.variantName].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-0.5 text-[13px] text-muted tabular-nums">{t.paid(money(h.cost, h.currency), dateText(h.bought))}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold">
          <Link href={slabHref(h)} className="inline-flex items-center gap-1 text-muted transition-colors duration-150 hover:text-ink">
            <ArrowSquareOutIcon size={14} aria-hidden /> {t.open}
          </Link>
          <button
            type="button"
            onClick={() => setEditingValue((v) => !v)}
            aria-expanded={editingValue}
            className="inline-flex items-center gap-1 text-muted transition-colors duration-150 hover:text-ink aria-expanded:text-ink"
          >
            <CurrencyDollarIcon size={14} aria-hidden /> {t.updateValue}
          </button>
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-muted transition-colors duration-150 hover:text-ink">
            <PencilSimpleIcon size={14} aria-hidden /> {t.edit}
          </button>
          {confirm ? (
            <span className="inline-flex items-center gap-2">
              {t.removeConfirm}
              <button type="button" onClick={() => void portfolioStore.remove(h.id).catch(() => {})} className="rounded-md bg-down px-2 py-0.5 text-panel">
                {t.removeYes}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="text-muted">{t.cancel}</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1 text-muted transition-colors duration-150 hover:text-down">
              <TrashIcon size={14} aria-hidden /> {t.remove}
            </button>
          )}
        </div>
        {editingValue && <ValueEditor h={h} onDone={() => setEditingValue(false)} />}
      </div>
      <div className="flex items-end justify-between gap-4 sm:flex-col sm:items-end sm:justify-start sm:text-right">
        {loading ? (
          <span className="skeleton h-6 w-20 rounded" />
        ) : s.price == null ? (
          <button
            type="button"
            onClick={() => setEditingValue(true)}
            className="max-w-[18ch] rounded-lg text-left text-[13px] text-muted underline decoration-dotted underline-offset-4 transition-colors duration-150 hover:text-ink sm:text-right"
          >
            {t.noPriceHint}
          </button>
        ) : (
          <>
            <div>
              <p className="text-[20px] font-extrabold tabular-nums tracking-[-0.02em] [font-stretch:110%]">{money(s.price, h.currency)}</p>
              <p className={`text-[13.5px] font-semibold tabular-nums ${up ? "text-up" : "text-down"}`}>
                {(up ? "+" : "−") + money(Math.abs(s.pnl!), h.currency)} · {pct(s.pnlPct)}
              </p>
            </div>
            <Spark values={s.spark} />
          </>
        )}
      </div>
    </motion.li>
  );
}

// Valor de hoy en línea: se guarda como precio puesto a mano de esa carta, versión y nota.
function ValueEditor({ h, onDone }: { h: Holding; onDone: () => void }) {
  const t = es.portfolio;
  const [v, setV] = useState("");
  const [error, setError] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseAmount(v);
    if (!n || n <= 0) return setError(true);
    try {
      await saveSlabValue(h, n);
      onDone();
    } catch {
      alert(t.storageError);
    }
  }
  return (
    <form onSubmit={submit} className="mt-3 flex max-w-[320px] items-center gap-2">
      <label className="relative min-w-0 flex-1">
        <span className="vh">{t.updateValueLabel(h.card.name)}</span>
        <input
          autoFocus
          value={v}
          onChange={(e) => {
            setV(e.target.value);
            setError(false);
          }}
          inputMode="decimal"
          autoComplete="off"
          placeholder={t.valueToday}
          aria-invalid={error}
          className="min-h-10 w-full rounded-xl border border-line bg-panel px-3 text-[14.5px] tabular-nums outline-none transition-[border-color] duration-150 focus:border-ink aria-invalid:border-down"
        />
      </label>
      <button type="submit" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-[13.5px] font-semibold text-panel transition-transform duration-150 active:scale-[0.97]">
        <CheckIcon size={14} weight="bold" aria-hidden /> {t.saveValue}
      </button>
    </form>
  );
}

// Mini gráfica del precio de su nota desde la compra.
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 96;
  const H = 30;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4)).toFixed(1)}`).join(" ");
  const up = values.at(-1)! >= values[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0 overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Estado vacío: tres fundas de ejemplo en abanico con el código de color de cada empresa.
function EmptyStack() {
  const blank = { id: "x", externalId: "x", name: "", localId: "", language: "EN" as const, image: null };
  const items = [
    { grader: "CGC" as const, gradeId: "9.5", r: -9, x: -38 },
    { grader: "BGS" as const, gradeId: "9.5", r: 7, x: 38 },
    { grader: "PSA" as const, gradeId: "10", r: 0, x: 0 },
  ];
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-[360px]" aria-hidden>
      {items.map((it, i) => (
        <motion.div
          key={it.grader}
          className="absolute left-1/2 top-1/2 w-[150px]"
          initial={{ opacity: 0, y: 20, x: "-50%", rotate: 0 }}
          animate={{ opacity: 1, y: "-50%", x: `calc(-50% + ${it.x}px)`, rotate: it.r }}
          transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }}
        >
          <SlabThumb card={blank} grader={it.grader} gradeId={it.gradeId} />
        </motion.div>
      ))}
    </div>
  );
}

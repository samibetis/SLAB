import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import type { RankedCard } from "@/lib/db/schema";
import { es } from "@/lib/i18n/es";
import { dayLong, money } from "@/lib/prices/format";
import { RANKING_CURRENCY } from "@/lib/rankings/logic";
import { bigImage, rankingBySlug } from "@/lib/rankings/data";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

// Enlace al visor con la versión de ese precio
const cardLink = (c: RankedCard, lang: string) =>
  `/?card=${encodeURIComponent(c.id)}&ext=${encodeURIComponent(c.externalId)}&lang=${lang}&variant=${encodeURIComponent(c.variant)}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await rankingBySlug(slug).catch(() => null);
  if (!data) return { title: es.rankings.metaTitle };
  const t = es.rankings;
  const { set, ranking } = data;
  const top = ranking?.top[0];
  const title = t.setMetaTitle(set.name, set.code);
  const description = t.setMetaDescription(set.name, top?.name ?? null, top ? money(top.price, ranking!.currency) : null);
  const image = bigImage(top?.image ?? null);
  return {
    title,
    description,
    alternates: { canonical: `/colecciones/${slug}` },
    openGraph: { title, description, url: `/colecciones/${slug}`, ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function SetRankingPage({ params }: Props) {
  const { slug } = await params;
  const data = await rankingBySlug(slug).catch(() => null);
  if (!data) notFound();
  const t = es.rankings;
  const { set, ranking } = data;
  const top = ranking?.top ?? [];
  const cur = ranking?.currency ?? RANKING_CURRENCY[set.language].currency;
  const lang = set.language;

  // Datos estructurados: lista ordenada (Google puede mostrarla como resultado enriquecido)
  const jsonLd = ranking && top.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: t.setTitle(set.name, set.code),
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: top.length,
        itemListElement: top.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${c.name} ${c.number ?? c.localId}${c.variantName ? ` (${c.variantName})` : ""}`,
          url: `${SITE_URL}${cardLink(c, lang)}`,
          ...(c.image ? { image: c.image } : {}),
        })),
      }
    : null;

  return (
    <>
      <div className="bg-[radial-gradient(70%_60%_at_70%_10%,var(--stage-a),var(--stage-b)_85%)]">
        <SiteHeader current="colecciones" />
        <main className="mx-auto max-w-[1400px] px-4 pb-24 md:px-10">
          {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
          <header className="pb-10 pt-4">
            <Link href="/colecciones" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted transition-colors duration-200 hover:text-ink">
              <ArrowLeftIcon size={15} aria-hidden /> {t.back}
            </Link>
            <h1 className="mt-4 max-w-[20ch] text-balance text-[clamp(32px,4.4vw,60px)] font-extrabold leading-[0.95] tracking-[-0.03em] [font-stretch:125%]">
              {t.setTitle(set.name, set.code)}
            </h1>
            <p className="mt-4 text-[15px] text-muted">
              {[ranking ? t.setMeta(ranking.cardCount, ranking.pricedCount) : null, set.releaseDate ? t.released(dayLong(set.releaseDate)) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>

          {!ranking ? (
            <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
              <p className="text-[18px] font-bold">{t.pendingTitle}</p>
              <p className="mx-auto mt-2 max-w-[48ch] text-[15px] text-muted">{t.pendingText}</p>
            </div>
          ) : top.length === 0 ? (
            <p className="text-[15px] text-muted">{t.empty}</p>
          ) : (
            <>
              {/* podio: las tres primeras, grandes */}
              <ol className="grid gap-4 sm:grid-cols-3" aria-label={t.setTitle(set.name, set.code)}>
                {top.slice(0, 3).map((c, i) => (
                  <li key={c.id} className={i === 0 ? "sm:row-span-1" : ""}>
                    <Link href={cardLink(c, lang)} className="group flex h-full flex-col rounded-3xl bg-panel p-4 transition-transform duration-200 hover:-translate-y-1 active:scale-[0.99]">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[40px] font-extrabold leading-none tabular-nums tracking-[-0.04em] [font-stretch:125%]" aria-label={t.rank(i + 1)}>
                          {i + 1}
                        </span>
                        <span className="text-[22px] font-extrabold tabular-nums tracking-[-0.02em] [font-stretch:110%]">{money(c.price, cur)}</span>
                      </div>
                      <div className="mt-4 grid flex-1 place-items-center rounded-2xl bg-soft p-4">
                        {c.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- imágenes de TCGdex / pokemontcg.io
                          <img
                            src={bigImage(c.image)!}
                            alt={`${c.name} ${c.number ?? c.localId}`}
                            loading={i === 0 ? "eager" : "lazy"}
                            className="aspect-[63/88] w-full max-w-[170px] sm:max-w-[240px] rounded-[10px] object-cover shadow-[0_18px_36px_-18px_rgb(var(--shadow-tint)/0.6)] transition-transform duration-300 group-hover:-rotate-1 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <span className="aspect-[63/88] w-full max-w-[170px] sm:max-w-[240px] rounded-[10px] bg-panel" />
                        )}
                      </div>
                      <p className="mt-4 text-[17px] font-bold leading-tight">{c.name}</p>
                      <p className="mt-0.5 text-[13.5px] text-muted">{[c.number ?? c.localId, c.variantName].filter(Boolean).join(" · ")}</p>
                    </Link>
                  </li>
                ))}
              </ol>

              {/* del 4 al 10 */}
              {top.length > 3 && (
                <ol start={4} className="mt-6 flex flex-col gap-2">
                  {top.slice(3).map((c, i) => (
                    <li key={c.id}>
                      <Link
                        href={cardLink(c, lang)}
                        className="group grid grid-cols-[40px_44px_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-panel p-3 pr-4 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
                      >
                        <span className="text-center text-[22px] font-extrabold tabular-nums text-muted [font-stretch:115%]" aria-label={t.rank(i + 4)}>{i + 4}</span>
                        <span className="h-[61px] w-[44px] overflow-hidden rounded-[4px] bg-soft">
                          {c.image && (
                            // eslint-disable-next-line @next/next/no-img-element -- miniaturas
                            <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15.5px] font-bold">{c.name}</span>
                          <span className="block truncate text-[13px] text-muted">{[c.number ?? c.localId, c.variantName].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-[17px] font-extrabold tabular-nums">{money(c.price, cur)}</span>
                          <ArrowRightIcon size={15} className="text-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-8 max-w-[80ch] text-[13px] leading-relaxed text-muted">
                {t.source(RANKING_CURRENCY[set.language].label, dayLong(ranking.scannedAt.toISOString().slice(0, 10)))}
              </p>
            </>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}

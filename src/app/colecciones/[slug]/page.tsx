import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { RankingGallery } from "@/components/rankings/RankingGallery";
import { SiteHeader } from "@/components/SiteHeader";
import type { RankedCard } from "@/lib/db/schema";
import { es } from "@/lib/i18n/es";
import { dayLong, money } from "@/lib/prices/format";
import { RANKING_CURRENCY, rankedCardHref } from "@/lib/rankings/logic";
import { bigImage, rankingBySlug } from "@/lib/rankings/data";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

// Enlace al visor con la versión de ese precio
const cardLink = (c: RankedCard, lang: string) => rankedCardHref(c, lang);

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
              <RankingGallery top={top} lang={lang} currency={cur} setName={set.name} />
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

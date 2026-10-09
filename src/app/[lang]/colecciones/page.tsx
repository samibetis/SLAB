import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { RankingIndex } from "@/components/rankings/RankingIndex";
import { SiteHeader } from "@/components/SiteHeader";
import { langOf, localeMeta } from "@/lib/i18n/seo";
import { getI18n } from "@/lib/i18n/server";
import { rankingIndex } from "@/lib/rankings/data";

// Se regenera como mucho cada 10 minutos: recoge pronto lo que vaya terminando el barrido.
export const revalidate = 600;

export async function generateMetadata({ params }: PageProps<"/[lang]/colecciones">): Promise<Metadata> {
  const { lang, t } = await langOf(params);
  const m = localeMeta(lang, "/colecciones");
  return {
    title: t.rankings.metaTitle,
    description: t.rankings.metaDescription,
    alternates: m.alternates,
    openGraph: { ...m.openGraph, title: t.rankings.metaTitle, description: t.rankings.metaDescription },
  };
}

export default async function RankingsPage() {
  const t = (await getI18n()).t.rankings;
  const sets = await rankingIndex().catch(() => []);
  return (
    <>
      <div className="bg-[radial-gradient(70%_60%_at_25%_10%,var(--stage-a),var(--stage-b)_85%)]">
        <SiteHeader current="colecciones" />
        <main className="mx-auto max-w-[1400px] px-4 pb-24 md:px-10">
          <header className="pb-8 pt-4 md:pb-12">
            <h1 className="max-w-[18ch] text-balance text-[clamp(34px,4.6vw,64px)] font-extrabold leading-[0.95] tracking-[-0.03em] [font-stretch:125%]">
              {t.title}
            </h1>
            <p className="mt-4 max-w-[56ch] text-[clamp(16px,1.25vw,18px)] leading-relaxed text-muted">{t.lead}</p>
          </header>
          <RankingIndex sets={sets} />
        </main>
      </div>
      <Footer />
    </>
  );
}

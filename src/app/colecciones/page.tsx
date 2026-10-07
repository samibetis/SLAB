import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { RankingIndex } from "@/components/rankings/RankingIndex";
import { SiteHeader } from "@/components/SiteHeader";
import { es } from "@/lib/i18n/es";
import { rankingIndex } from "@/lib/rankings/data";

// Se regenera como mucho cada hora (el barrido es semanal; esto solo recoge lo que vaya terminando).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: es.rankings.metaTitle,
  description: es.rankings.metaDescription,
  alternates: { canonical: "/colecciones" },
  openGraph: { title: es.rankings.metaTitle, description: es.rankings.metaDescription, url: "/colecciones" },
};

export default async function RankingsPage() {
  const t = es.rankings;
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

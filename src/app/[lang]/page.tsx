import type { Metadata } from "next";
import { Suspense } from "react";
import { langOf, localeMeta } from "@/lib/i18n/seo";
import { CardFromUrl } from "@/components/CardFromUrl";
import { CardProvider } from "@/components/CardContext";
import { PriceProvider } from "@/components/prices/PriceContext";
import { Hero } from "@/components/Hero";
import { AnalysisSection, HowSection, PricesSection } from "@/components/Sections";
import { Footer } from "@/components/Footer";
import s from "@/components/Sections.module.css";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang, t } = await langOf(params);
  const m = localeMeta(lang, "/");
  return { alternates: m.alternates, openGraph: { ...m.openGraph, title: t.meta.title, description: t.meta.description } };
}

export default function Home() {
  return (
    <CardProvider>
      <PriceProvider>
        {/* lee ?card= de la URL; va en Suspense porque la página es estática */}
        <Suspense fallback={null}>
          <CardFromUrl />
        </Suspense>
        <Hero />
        <main className={s.main}>
          <PricesSection />
          <AnalysisSection />
          <HowSection />
        </main>
        <Footer />
      </PriceProvider>
    </CardProvider>
  );
}

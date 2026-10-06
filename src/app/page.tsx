import { Suspense } from "react";
import { CardFromUrl } from "@/components/CardFromUrl";
import { CardProvider } from "@/components/CardContext";
import { PriceProvider } from "@/components/prices/PriceContext";
import { Hero } from "@/components/Hero";
import { AnalysisSection, HowSection, PricesSection } from "@/components/Sections";
import { Footer } from "@/components/Footer";
import s from "@/components/Sections.module.css";

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

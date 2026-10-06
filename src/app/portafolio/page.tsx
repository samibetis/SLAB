import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { PortfolioView } from "@/components/portfolio/PortfolioView";
import { SiteHeader } from "@/components/SiteHeader";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.portfolio.metaTitle, description: es.portfolio.metaDescription };

// Portafolio de gradeadas: la página es de servidor; los slabs viven en el navegador (componente cliente).
export default function PortfolioPage() {
  return (
    <>
      <div className="bg-[radial-gradient(70%_60%_at_25%_20%,var(--stage-a),var(--stage-b)_85%)]">
        <SiteHeader current="portafolio" />
        <main>
          {/* la cabecera (título y vitrina) la pinta PortfolioView, que conoce tus slabs */}
          <PortfolioView />
        </main>
      </div>
      <Footer />
    </>
  );
}

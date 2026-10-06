import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Scanner } from "@/components/scanner/Scanner";
import { SiteHeader } from "@/components/SiteHeader";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = {
  title: es.scanner.metaTitle,
  description: es.scanner.metaDescription,
};

// Escáner de cartas: la página es de servidor; la cámara y el OCR viven en el componente cliente.
export default function ScannerPage() {
  const t = es.scanner;
  return (
    <>
      <div className="bg-[radial-gradient(70%_60%_at_30%_30%,var(--stage-a),var(--stage-b)_85%)]">
        <SiteHeader current="escaner" />
        <main>
          <header className="mx-auto max-w-[1400px] px-4 pb-8 pt-4 md:px-10 md:pb-10">
            <h1 className="text-balance text-[clamp(34px,4.4vw,60px)] font-extrabold leading-[0.95] tracking-[-0.03em] [font-stretch:125%]">
              {t.title}
            </h1>
            <p className="mt-4 max-w-[52ch] text-[clamp(16px,1.25vw,18px)] leading-relaxed text-muted">{t.lead}</p>
          </header>
          <Scanner />
        </main>
      </div>
      <Footer />
    </>
  );
}

import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/components/I18nProvider";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { DICTS, LANGS, isLang } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import "../globals.css";

// Archivo con eje de anchura (font-stretch 62–125%), servida desde nuestro propio dominio.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

// Layout raíz de cada idioma: /es (sin prefijo en la dirección, ver src/proxy.ts) y /en.
export const dynamicParams = false;
export const generateStaticParams = () => LANGS.map((lang) => ({ lang }));

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const t = DICTS[isLang(lang) ? lang : "es"];
  return { metadataBase: new URL(SITE_URL), title: t.meta.title, description: t.meta.description };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} className={archivo.variable}>
      <body>
        <I18nProvider lang={lang}>
          <MotionProvider>{children}</MotionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

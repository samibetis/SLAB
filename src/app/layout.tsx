import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { es } from "@/lib/i18n/es";
import { MotionProvider } from "@/components/ui/MotionProvider";
import "./globals.css";

// Archivo con eje de anchura (font-stretch 62–125%), servida desde nuestro propio dominio.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: es.meta.title,
  description: es.meta.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={archivo.variable}>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}

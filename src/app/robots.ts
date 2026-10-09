import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Las APIs y las páginas privadas del usuario (su colección y su portafolio viven en su navegador) no
// se indexan.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/coleccion/", "/portafolio", "/en/coleccion/", "/en/portafolio"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

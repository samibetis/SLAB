import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite una segunda instancia aislada (otro puerto, pruebas) sin pisar el .next del servidor principal.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // PGlite carga un .wasm y archivos de datos propios: no debe empaquetarse.
  serverExternalPackages: ["@electric-sql/pglite"],
  images: {
    // Imágenes de carta permitidas para next/image (miniaturas del buscador).
    remotePatterns: [
      { protocol: "https", hostname: "assets.tcgdex.net" },
      { protocol: "https", hostname: "images.pokemontcg.io" },
    ],
  },
};

export default nextConfig;

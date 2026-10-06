import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/scan/identify  { image: "<jpeg en base64, sin prefijo data:>" }
// Pide a Claude que identifique la carta de la foto y devuelve lo que necesita el buscador.
// Se usa solo cuando el OCR del navegador no está seguro (cuesta dinero por llamada).

const CardId = z.object({
  isCard: z.boolean().describe("true si la foto muestra una carta del Pokémon TCG"),
  name: z.string().describe("Nombre de la carta tal como está impreso, en su idioma"),
  setName: z.string().describe("Nombre de la colección en inglés si se conoce; si no, vacío"),
  setCode: z.string().describe("Código de colección impreso abajo (p. ej. PAF, SV2a); vacío si no hay"),
  number: z.string().describe("Número impreso antes de la barra, con sus ceros (p. ej. 054); vacío si no se lee"),
  language: z.enum(["EN", "JP", "OTHER"]),
  confidence: z.enum(["high", "medium", "low"]),
});

const PROMPT = `Identifica la carta del Pokémon TCG de la foto.
Lee lo impreso: el nombre arriba y, abajo, el código de colección y el número (por ejemplo "PAF EN 054/091" -> setCode PAF, number 054).
Si un dato no se lee con claridad, déjalo vacío en lugar de suponerlo. Si no es una carta del Pokémon TCG, isCard=false.`;

const MAX_B64 = 2_000_000; // ~1,5 MB de imagen

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!rateLimit(`ai:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "30" } });
  }

  const body = (await req.json().catch(() => null)) as { image?: unknown } | null;
  const image = typeof body?.image === "string" ? body.image : "";
  if (!image || image.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return NextResponse.json({ error: "bad_image" }, { status: 400 });
  }

  let client: Anthropic;
  try {
    client = new Anthropic(); // credenciales del entorno (ANTHROPIC_API_KEY u otra fuente configurada)
  } catch {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  try {
    const res = await client.beta.messages.parse(
      {
        model: "claude-opus-5-5",
        max_tokens: 2000,
        // si los filtros de seguridad rechazaran la petición, la API reintenta sola con otro modelo
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(CardId) },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      },
      { signal: req.signal },
    );
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return NextResponse.json({ error: "not_identified" }, { status: 422 });
    }
    return NextResponse.json(res.parsed_output);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    if (e instanceof Anthropic.APIError) {
      console.error("[scan/identify]", e.status, e.message);
      return NextResponse.json({ error: "ai_error" }, { status: 502 });
    }
    // sin credenciales el SDK lanza al hacer la petición
    console.error("[scan/identify]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }
}

// Recortes y preparación de imagen para el escáner (navegador). La carta se normaliza a 945 x 1320 px
// (proporción real 63 x 88 mm); de ahí se sacan las zonas que lee el OCR.

export const CARD_W = 945;
export const CARD_H = 1320;

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

// Recorta de un vídeo (mostrado con object-cover) el rectángulo del marco guía, en coordenadas de pantalla.
export function cropFromVideo(video: HTMLVideoElement, frame: DOMRect, box: DOMRect): HTMLCanvasElement {
  const vw = video.videoWidth, vh = video.videoHeight;
  const s = Math.max(box.width / vw, box.height / vh); // escala de object-cover
  const ox = (box.width - vw * s) / 2, oy = (box.height - vh * s) / 2;
  const sx = (frame.left - box.left - ox) / s, sy = (frame.top - box.top - oy) / s;
  const out = canvas(CARD_W, CARD_H);
  out.getContext("2d")!.drawImage(video, sx, sy, frame.width / s, frame.height / s, 0, 0, CARD_W, CARD_H);
  return out;
}

// Foto subida: se asume que la carta ocupa la foto; recorte centrado con la proporción de la carta.
export function cropFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const r = CARD_W / CARD_H;
  let w = img.naturalWidth, h = img.naturalHeight;
  if (w / h > r) w = h * r;
  else h = w / r;
  const out = canvas(CARD_W, CARD_H);
  out.getContext("2d")!.drawImage(img, (img.naturalWidth - w) / 2, (img.naturalHeight - h) / 2, w, h, 0, 0, CARD_W, CARD_H);
  return out;
}

// Zona de la carta (fracciones de ancho y alto), ampliada para el OCR:
//  - "gray": grises con más contraste.
//  - "threshold": blanco o negro puro; separa mejor el texto claro sobre fondo oscuro (código, número).
export function region(
  card: HTMLCanvasElement,
  x0: number, x1: number, y0: number, y1: number,
  mode: "gray" | "threshold",
  scale = 2,
): HTMLCanvasElement {
  const sx = Math.round(card.width * x0), sy = Math.round(card.height * y0);
  const sw = Math.round(card.width * (x1 - x0)), sh = Math.round(card.height * (y1 - y0));
  const out = canvas(Math.round(sw * scale), Math.round(sh * scale));
  const x = out.getContext("2d", { willReadFrequently: true })!;
  x.imageSmoothingQuality = "high";
  x.drawImage(card, sx, sy, sw, sh, 0, 0, out.width, out.height);
  const d = x.getImageData(0, 0, out.width, out.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    const v = mode === "threshold" ? (g > 150 ? 255 : 0) : Math.max(0, Math.min(255, (g - 128) * 1.5 + 128));
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
  }
  x.putImageData(d, 0, 0);
  return out;
}

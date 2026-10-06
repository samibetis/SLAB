import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { CardSummary } from "@/lib/cards/types";
import type { FoilMode } from "@/lib/cards/variants";
import { GRADERS, bgsSubgrades, gradeOption, labelColors, type GraderId } from "@/lib/grading/companies";
import { es } from "@/lib/i18n/es";

// Motor del visor 3D. Es three.js "a pelo", sin React: el componente solo lo monta, le pasa estado
// (carta, versión, nota, funda, escaneo) y lo destruye. Así se puede ampliar sin tocar la interfaz.

// Colores de la plantilla del frontal por tipo: [claro, oscuro, tinta]
const TYPES: Record<string, [string, string, string]> = {
  fire: ["#F6B08A", "#D8532E", "#2B1206"],
  water: ["#9CCBF0", "#2F7FC4", "#071C30"],
  grass: ["#B7E09B", "#4C9A3C", "#0E2408"],
  lightning: ["#FBE9A0", "#E5B624", "#2A2104"],
  psychic: ["#D9B5EA", "#8E4FAE", "#220B2E"],
  fighting: ["#E6B48E", "#A85D33", "#28130A"],
  darkness: ["#6E7685", "#2C313B", "#F1F3F6"],
  metal: ["#DDE3E9", "#8C98A6", "#161C22"],
  dragon: ["#E6D08C", "#A7862E", "#251C04"],
  fairy: ["#F7C9DC", "#D97FA7", "#33101F"],
  colorless: ["#F2F0EC", "#C9C3B6", "#1E1C17"],
};

// Brillo holográfico (ver FoilMode): ninguno, toda la carta, solo la ventana del arte, o todo menos la ventana.
export type { FoilMode };
const FOIL_CODE: Record<FoilMode, number> = { none: 0, all: 1, window: 2, reverse: 3 };

export interface CardViewer {
  setCard(card: CardSummary | null): void; // carta nueva: descarta imagen y escaneo anteriores
  updateCard(card: CardSummary | null): void; // mismos datos con algún cambio (p. ej. la edición): no descarta imágenes
  setFoil(mode: FoilMode): void;
  setStamp(stamp: string | null): void; // sello de la versión: "1st-edition" o cualquier otro texto
  setBack(img: HTMLImageElement | null, inset?: number): void; // reverso real; null = reverso dibujado
  setCardImage(img: HTMLImageElement | null): void; // imagen real de la carta (la del catálogo)
  setScan(img: HTMLImageElement | null): void; // escaneo del usuario: tiene prioridad sobre la anterior
  setSlab(on: boolean): void;
  setGrader(grader: GraderId, gradeId: string): void; // empresa de gradeo: forma de la funda y etiqueta
  setGrade(gradeId: string): void; // nota dentro de la escala de esa empresa
  reset(): void; // deja la carta de frente
  redraw(): void;
  dispose(): void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const cssVar = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const langName = (l?: string) => (l && es.viewer.languages[l]) || l || "";
const isUnlimited = (e?: string) => !!e && /^unlimited$/i.test(e);

// Medidas de la carta en unidades de escena (proporción real 63 x 88 mm) y de su canto.
const CW = 2.5, CH = 3.5, CR = 0.13, CT = 0.02;
// Radio de las esquinas en las texturas (750 x 1050 px), el mismo que el de la geometría.
const TEX_R = Math.round((CR / CW) * 750);

// Textura dibujada en un canvas 2D (frontal, dorso y etiqueta de la funda).
function makeCanvasTexture(renderer: THREE.WebGLRenderer, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; // las imágenes están en sRGB: así los colores salen fieles
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return { c, x: c.getContext("2d")!, t };
}

// Rectángulo con esquinas redondeadas como camino de canvas.
function roundRect(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}

// Rectángulo con esquinas redondeadas centrado en el origen, para la geometría 3D (carta, funda, marcos).
function roundedShape(w: number, h: number, r: number, path: THREE.Shape | THREE.Path = new THREE.Shape()) {
  const x = -w / 2, y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

// Escribe texto reduciendo el cuerpo hasta que cabe en `max` píxeles.
function fitText(x: CanvasRenderingContext2D, t: string, X: number, Y: number, max: number) {
  const m = x.font.match(/(\d+)px/);
  let s = m ? +m[1] : 30;
  while (s > 12 && x.measureText(t).width > max) {
    s -= 2;
    x.font = x.font.replace(/\d+px/, s + "px");
  }
  x.fillText(t, X, Y);
}

const VERT = "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";

// Frontal: la imagen más el foil. El foil tiene tres capas que dependen de la inclinación (`tilt`):
// bandas de arcoíris, un reflejo diagonal y destellos (cada celda de una rejilla fina es un "cristal"
// orientado al azar que brilla cuando la luz le llega de frente). `mode` decide en qué zona cae.
const FRONT_FRAG = `
  uniform sampler2D map;uniform vec2 tilt;uniform float holo;uniform float mode;uniform vec4 win;varying vec2 vUv;
  vec3 hue(float h){return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){
    vec4 c=texture2D(map,vUv);if(c.a<.5)discard;
    float band=vUv.x*.9+vUv.y*.7+tilt.x*1.4-tilt.y*.9;
    float sheen=1.-abs(fract(band*.5)-.5)*2.;
    float glare=pow(max(0.,1.-abs((vUv.x-vUv.y)+tilt.x*1.6+tilt.y*1.2)),10.);
    // zona con brillo según el modo: 0 ninguna, 1 toda, 2 ventana del arte, 3 todo menos la ventana
    float inWin=step(win.x,vUv.x)*step(vUv.x,win.z)*step(win.y,vUv.y)*step(vUv.y,win.w);
    float m=mode<.5?0.:mode<1.5?1.:mode<2.5?inWin:1.-inWin;
    // destellos: más finos en reverse, como su patrón real
    vec2 grid=mode>2.5?vec2(220.,308.):vec2(140.,196.);
    vec2 cell=floor(vUv*grid);
    float a=hash(cell)*6.2831;
    float on=step(.55,hash(cell+7.31));
    vec2 t=tilt+vec2(.0001);
    float spark=on*pow(max(0.,dot(normalize(t),vec2(cos(a),sin(a)))),36.)*clamp(length(tilt)*2.2,0.,1.);
    vec3 col=c.rgb+hue(fract(band))*holo*.17*sheen*m+vec3(glare*.32*holo*(.25+.75*m))+vec3(spark*.85*holo*m);
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
  }`;

// Reflejo diagonal sobre el plástico de la funda.
const GLARE_FRAG = `
  uniform vec2 tilt;varying vec2 vUv;
  void main(){float d=abs((vUv.x-vUv.y)+tilt.x*1.8+tilt.y*1.2+.2);
    float a=pow(max(0.,1.-d),14.)*.26+pow(max(0.,1.-abs(d-.35)),40.)*.12;gl_FragColor=vec4(vec3(1.),a);
    #include <colorspace_fragment>
  }`;

export function createCardViewer(stage: HTMLElement, fontFamily: string): CardViewer {
  // Móvil o pantalla táctil: menos resolución y sin reflejos de entorno, para no penalizar.
  const lowPower = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 600;

  const R = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // lanza si no hay WebGL
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
  R.setClearColor(0x000000, 0);
  stage.appendChild(R.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const root = new THREE.Group();
  scene.add(root);

  // Entorno de luz (un "estudio" generado) para los reflejos del plástico y del canto de la carta.
  let envTex: THREE.Texture | null = null;
  if (!lowPower) {
    const pmrem = new THREE.PMREMGenerator(R);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();
  }

  const F = makeCanvasTexture(R, 750, 1050);
  const B = makeCanvasTexture(R, 750, 1050);
  const L = makeCanvasTexture(R, 1024, 330);

  // ---- Carta: frontal (shader con foil), dorso y canto con grosor ----
  const frontMat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: F.t }, tilt: { value: new THREE.Vector2() }, holo: { value: 1 }, mode: { value: FOIL_CODE.all },
      // ventana del arte en un frontal estándar (uv con y hacia arriba); aproximada, vale para la mayoría de cartas
      win: { value: new THREE.Vector4(0.075, 0.495, 0.925, 0.885) },
    },
    vertexShader: VERT,
    fragmentShader: FRONT_FRAG,
  });
  const shape = roundedShape(CW, CH, CR) as THREE.Shape;
  const faceGeo = new THREE.ShapeGeometry(shape, 10);
  // ShapeGeometry pone como uv las coordenadas de la forma: se pasan a 0..1 para que la textura encaje.
  const uv = faceGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + CW / 2) / CW, (uv.getY(i) + CH / 2) / CH);
  const front = new THREE.Mesh(faceGeo, frontMat);
  front.position.z = CT / 2 + 0.0006;
  const backMat = new THREE.MeshBasicMaterial({ map: B.t, alphaTest: 0.5 });
  const back = new THREE.Mesh(faceGeo, backMat);
  back.rotation.y = Math.PI;
  back.position.z = -CT / 2 - 0.0006;
  // Canto: una extrusión de la silueta; sus tapas no se pintan (las cubren frontal y dorso).
  const edgeGeo = new THREE.ExtrudeGeometry(shape, { depth: CT, bevelEnabled: false, curveSegments: 10 });
  edgeGeo.translate(0, 0, -CT / 2);
  const capMat = new THREE.MeshBasicMaterial({ visible: false });
  const sideMat = envTex
    ? new THREE.MeshStandardMaterial({ color: 0xeeebe3, roughness: 0.55, metalness: 0 })
    : new THREE.MeshBasicMaterial({ color: 0xdcd8cf });
  const edge = new THREE.Mesh(edgeGeo, [capMat, sideMat]);
  const card = new THREE.Group();
  card.add(edge, front, back);
  root.add(card);

  // ---- Funda: se construye según la empresa (forma, interior y etiqueta) ----
  const shellMat: THREE.MeshBasicMaterial | THREE.MeshPhysicalMaterial = envTex
    ? new THREE.MeshPhysicalMaterial({
        color: 0xffffff, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05,
        envMapIntensity: 1.5, transparent: true, opacity: 0.3, depthWrite: false,
      })
    : new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
  const edgeMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.5 });
  const wellMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.22 });
  const insertMat = envTex
    ? new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.7, metalness: 0 })
    : new THREE.MeshBasicMaterial({ color: 0x111214 });
  const labelMat = new THREE.MeshBasicMaterial({ map: L.t });
  const glareMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { tilt: { value: new THREE.Vector2() } },
    vertexShader: VERT,
    fragmentShader: GLARE_FRAG,
  });
  const slab = new THREE.Group();
  root.add(slab);
  let slabGeos: THREE.BufferGeometry[] = [];
  let cardInSlabY = -0.42; // altura de la carta dentro de la funda (depende del alto de la etiqueta)

  function buildSlab() {
    slabGeos.forEach((geo) => geo.dispose());
    slabGeos = [];
    slab.clear();
    const s = GRADERS[grader].slab;
    const keep = <T extends THREE.BufferGeometry>(geo: T) => (slabGeos.push(geo), geo);

    // Carcasa: extrusión con esquinas redondeadas y canto biselado, como el plástico real
    const bevel = Math.min(0.045, s.d * 0.16);
    const shellGeo = keep(new THREE.ExtrudeGeometry(roundedShape(s.w, s.h, s.r) as THREE.Shape, {
      depth: s.d - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 14,
    }));
    shellGeo.translate(0, 0, -(s.d - 2 * bevel) / 2);
    slab.add(new THREE.Mesh(shellGeo, shellMat), new THREE.LineSegments(keep(new THREE.EdgesGeometry(shellGeo, 35)), edgeMat));

    // Reparto vertical: margen, etiqueta, separación con nervio y hueco de la carta
    const m = 0.16, gap = 0.13;
    const labelW = s.w - 2 * m;
    const labelTop = s.h / 2 - m;
    const areaTop = labelTop - s.labelH - gap;
    const areaBottom = -s.h / 2 + m;
    cardInSlabY = (areaTop + areaBottom) / 2;

    const label = new THREE.Mesh(keep(new THREE.PlaneGeometry(labelW, s.labelH)), labelMat);
    label.position.set(0, labelTop - s.labelH / 2, s.d / 2 - 0.035);
    const ridge = new THREE.LineSegments(keep(new THREE.EdgesGeometry(new THREE.BoxGeometry(labelW, 0.03, s.d * 0.82))), wellMat);
    ridge.position.y = labelTop - s.labelH - gap / 2;
    slab.add(label, ridge);

    // Interior: hueco transparente, funda interior (BGS) o marco negro alrededor de la carta (SGC)
    if (s.insert === "black") {
      const frame = roundedShape(labelW, areaTop - areaBottom, 0.08) as THREE.Shape;
      frame.holes.push(roundedShape(CW + 0.04, CH + 0.04, CR, new THREE.Path()) as THREE.Path);
      const frameMesh = new THREE.Mesh(keep(new THREE.ShapeGeometry(frame, 12)), insertMat);
      frameMesh.position.set(0, cardInSlabY, -0.004);
      slab.add(frameMesh);
    } else if (s.insert === "sleeve") {
      const sleeveGeo = keep(new THREE.ExtrudeGeometry(roundedShape(CW + 0.2, CH + 0.2, 0.1) as THREE.Shape, {
        depth: 0.11, bevelEnabled: false, curveSegments: 10,
      }));
      sleeveGeo.translate(0, 0, -0.055);
      const sleeve = new THREE.Mesh(sleeveGeo, shellMat);
      const sleeveEdges = new THREE.LineSegments(keep(new THREE.EdgesGeometry(sleeveGeo, 35)), wellMat);
      sleeve.position.y = sleeveEdges.position.y = cardInSlabY;
      slab.add(sleeve, sleeveEdges);
    } else {
      const well = new THREE.LineSegments(keep(new THREE.EdgesGeometry(new THREE.BoxGeometry(CW + 0.12, CH + 0.12, 0.06))), wellMat);
      well.position.y = cardInSlabY;
      slab.add(well);
    }

    const glare = new THREE.Mesh(keep(new THREE.PlaneGeometry(s.w, s.h)), glareMat);
    glare.position.z = s.d / 2 + 0.002;
    slab.add(glare);
  }

  // ---- Sombra suave detrás: se desplaza al contrario de la inclinación y da sensación de profundidad ----
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 256;
  {
    const sx = shadowCanvas.getContext("2d")!;
    const g = sx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, "rgba(0,0,0,.55)");
    g.addColorStop(0.55, "rgba(0,0,0,.18)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = g;
    sx.fillRect(0, 0, 256, 256);
  }
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5 });
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.z = -0.9;
  scene.add(shadow);

  let slabOn = true;
  let grader: GraderId = "PSA";
  let gradeId = "10";
  let cur: CardSummary | null = null;
  let scanImg: HTMLImageElement | null = null;
  let cardImg: HTMLImageElement | null = null;
  let backImg: HTMLImageElement | null = null;
  let backInset = 0;
  let stamp: string | null = null;

  // Con una imagen real (la carta o un escaneo) el holo baja: la imagen ya trae su propio brillo.
  const holo = () => { frontMat.uniforms.holo.value = scanImg || cardImg ? 0.55 : 1; };

  function drawFront() {
    const { x } = F, W = 750, H = 1050;
    x.clearRect(0, 0, W, H);
    x.save();
    roundRect(x, 0, 0, W, H, TEX_R);
    x.clip();
    const photo = scanImg ?? cardImg;
    if (photo) {
      // "cover": rellena el marco recortando lo que sobra
      const s = Math.max(W / photo.width, H / photo.height);
      const w = photo.width * s, h = photo.height * s;
      x.drawImage(photo, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      // plantilla generada por tipo (se usa cuando no hay imagen real)
      const ty = TYPES[cur?.type ?? ""] ?? TYPES.colorless;
      let g: CanvasGradient = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#F8DE6A"); g.addColorStop(0.5, "#E5B52C"); g.addColorStop(1, "#F6D85E");
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      roundRect(x, 30, 30, W - 60, H - 60, 20);
      g = x.createLinearGradient(0, 30, 0, H - 30);
      g.addColorStop(0, ty[0]); g.addColorStop(1, ty[1]);
      x.fillStyle = g; x.fill();
      x.fillStyle = ty[2]; x.textAlign = "left"; x.font = "700 44px " + fontFamily;
      fitText(x, cur ? cur.name : es.viewer.noCard, 62, 96, 470);
      x.font = "600 24px " + fontFamily; x.textAlign = "right";
      x.fillText(cur?.number ?? "", W - 62, 94);
      x.textAlign = "left";
      const ax = 62, ay = 122, aw = W - 124, ah = 440;
      x.fillStyle = "#D9C27A"; x.fillRect(ax - 8, ay - 8, aw + 16, ah + 16);
      x.save(); x.beginPath(); x.rect(ax, ay, aw, ah); x.clip();
      g = x.createRadialGradient(ax + aw / 2, ay + ah * 0.55, 10, ax + aw / 2, ay + ah * 0.55, aw * 0.8);
      g.addColorStop(0, "#fff"); g.addColorStop(0.35, ty[0]); g.addColorStop(1, ty[1]);
      x.fillStyle = g; x.fillRect(ax, ay, aw, ah);
      x.translate(ax + aw / 2, ay + ah * 0.55);
      x.fillStyle = "rgba(255,255,255,.16)";
      for (let i = 0; i < 28; i++) {
        x.rotate((Math.PI * 2) / 28);
        if (i % 2) { x.beginPath(); x.moveTo(0, 0); x.lineTo(aw, -30); x.lineTo(aw, 30); x.closePath(); x.fill(); }
      }
      x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 3;
      for (let r = 40; r < 420; r += 46) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
      x.restore();
      x.fillStyle = "#E9D58F"; x.fillRect(ax + 20, ay + ah + 18, aw - 40, 34);
      x.fillStyle = "#3A2E0A"; x.font = "italic 600 20px " + fontFamily; x.textAlign = "center";
      x.fillText(cur ? [cur.rarity, cur.year].filter(Boolean).join(", ") : es.viewer.noCardSub, W / 2, ay + ah + 42);
      x.textAlign = "left";
      x.fillStyle = "rgba(0,0,0,.13)";
      ([[0, 1], [1, 0.8], [2, 0.9], [4, 0.66], [5, 0.84]] as const).forEach(([i, w]) => {
        roundRect(x, 82, 660 + i * 44, (W - 164) * w, 16, 8); x.fill();
      });
      x.fillStyle = ty[2]; x.font = "600 20px " + fontFamily;
      fitText(x, cur ? [cur.set, langName(cur.language)].filter(Boolean).join(", ") : "", 62, H - 58, W - 124);
    }
    drawStamp(x, W, H);
    x.restore();
    F.t.needsUpdate = true;
  }

  // Sello de la versión sobre el frontal. El de 1ª edición imita el real (círculo negro con un 1);
  // el resto son insignias genéricas con el nombre del sello: no se copian logotipos ajenos.
  function drawStamp(x: CanvasRenderingContext2D, W: number, H: number) {
    if (!stamp) return;
    x.save();
    x.textAlign = "center";
    if (stamp === "1st-edition") {
      const cx = W * 0.125, cy = H * 0.545, r = 40;
      x.fillStyle = "#111"; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.font = "italic 800 46px " + fontFamily; x.fillText("1", cx, cy + 6);
      x.font = "700 11px " + fontFamily; x.fillText("EDITION", cx, cy + 26);
    } else {
      const cx = W - 112, cy = H - 112, r = 50;
      x.fillStyle = "rgba(20,24,30,.88)"; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "#fff"; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r - 5, 0, Math.PI * 2); x.stroke();
      const words = stamp.replace(/[-_]+/g, " ").toUpperCase().split(" ").slice(0, 2);
      x.fillStyle = "#fff";
      words.forEach((w, i) => {
        x.font = "800 15px " + fontFamily;
        let s = 15;
        while (s > 9 && x.measureText(w).width > r * 1.55) { s -= 1; x.font = `800 ${s}px ${fontFamily}`; }
        x.fillText(w, cx, cy + 5 + (i - (words.length - 1) / 2) * 18);
      });
    }
    x.restore();
  }

  function drawBack() {
    const { x } = B, W = 750, H = 1050;
    x.clearRect(0, 0, W, H);
    x.save();
    roundRect(x, 0, 0, W, H, TEX_R);
    x.clip();
    if (backImg) {
      // reverso real: recortando un margen (los escaneos traen bordes blancos) y rellenando el marco
      const sx = backImg.width * backInset, sy = backImg.height * backInset;
      const sw = backImg.width - 2 * sx, sh = backImg.height - 2 * sy;
      const k = Math.max(W / sw, H / sh), w = sw * k, h = sh * k;
      x.drawImage(backImg, sx, sy, sw, sh, (W - w) / 2, (H - h) / 2, w, h);
      x.restore();
      B.t.needsUpdate = true;
      return;
    }
    // sin imagen: reverso dibujado (mientras carga la real, o si falla)
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#1D3E7A"); g.addColorStop(1, "#0E1F45");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 2;
    for (let r = 30; r < 900; r += 30) { x.beginPath(); x.arc(W / 2, H / 2, r, 0, 7); x.stroke(); }
    x.lineWidth = 18; x.strokeStyle = "#14336A";
    roundRect(x, 22, 22, W - 44, H - 44, 24); x.stroke();
    x.fillStyle = "rgba(255,255,255,.88)"; x.font = "800 72px " + fontFamily; x.textAlign = "center";
    x.fillText("Slab", W / 2, H / 2 + 24);
    x.restore();
    B.t.needsUpdate = true;
  }

  // Etiqueta de la funda según la empresa: solo su código de color y disposición (sin logotipos).
  // Comunes a todas: nombre, año y colección, número y edición, nota y su palabra.
  function drawLabel() {
    const { x } = L, W = 1024, H = 330;
    const G = GRADERS[grader];
    const opt = gradeOption(grader, gradeId);
    const st = labelColors(G, opt);
    x.clearRect(0, 0, W, H);

    // Fondo y decoración propia de cada etiqueta
    if (st.layout === "metal") {
      const g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, st.bg); g.addColorStop(0.5, "#ffffff55"); g.addColorStop(0.51, st.bg); g.addColorStop(1, st.bg);
      x.fillStyle = st.bg; x.fillRect(0, 0, W, H);
      x.fillStyle = g; x.globalAlpha = 0.55; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
      x.lineWidth = 5; x.strokeStyle = st.accent; x.strokeRect(14, 14, W - 28, H - 28);
    } else {
      x.fillStyle = st.bg; x.fillRect(0, 0, W, H);
    }
    if (st.layout === "frame") { x.lineWidth = 16; x.strokeStyle = st.accent; x.strokeRect(8, 8, W - 16, H - 16); }
    if (st.layout === "dark") { x.fillStyle = st.accent; x.fillRect(40, 62, W - 80, 3); }
    const band = st.layout === "band" ? 70 : 0;
    if (band) { x.fillStyle = st.accent; x.fillRect(0, 0, W, band); }

    // Código de la empresa (texto con la tipografía del sitio, no su logotipo)
    x.font = "700 26px " + fontFamily;
    x.textAlign = "left";
    x.fillStyle = band ? "#ffffff" : st.sub;
    x.fillText(G.name, 44, band ? 46 : 48);

    // Datos de la carta
    const top = band ? 34 : 0;
    x.fillStyle = st.ink; x.font = "700 46px " + fontFamily;
    fitText(x, cur ? cur.name : es.viewer.noLabel, 44, top + 112, 600);
    x.fillStyle = st.sub; x.font = "500 32px " + fontFamily;
    fitText(x, cur ? [cur.year, cur.set].filter(Boolean).join(" ") : "", 44, top + 160, 600);
    x.font = "500 32px " + fontFamily;
    fitText(
      x,
      cur ? [cur.number ? "#" + cur.number : "", cur.edition && !isUnlimited(cur.edition) ? cur.edition : ""].filter(Boolean).join("   ") : "",
      44, top + 206, 600,
    );

    // Nota y su palabra, a la derecha
    x.textAlign = "right"; x.fillStyle = st.ink; x.font = "800 124px " + fontFamily;
    x.fillText(String(opt.value), W - 44, top + 176);
    x.font = "700 30px " + fontFamily;
    x.fillText(opt.word, W - 44, top + 226);

    // BGS: las cuatro subnotas en una tira inferior
    if (G.subgrades) {
      const subs = bgsSubgrades(opt.value);
      const names = es.viewer.subgrades;
      x.font = "600 21px " + fontFamily; x.fillStyle = st.sub; x.textAlign = "center";
      const cellW = (W - 88) / 4;
      subs.forEach((v, i) => x.fillText(`${names[i]} ${v}`, 44 + cellW * (i + 0.5), H - 34));
    }
    L.t.needsUpdate = true;
  }

  // Colores de la funda según el tema (claro/oscuro), leídos de las variables CSS.
  function theme() {
    const e = cssVar("--slab-edge") || "#13171C";
    edgeMat.color.set(e);
    wellMat.color.set(e);
    // con reflejos de entorno el plástico ya "se ve" por sus brillos: necesita mucha menos opacidad
    shellMat.opacity = (parseFloat(cssVar("--slab-shell")) || 0.3) * (envTex ? 0.4 : 1);
    // en oscuro la sombra apenas se ve contra el fondo: se intensifica un poco
    shadowMat.opacity = parseFloat(cssVar("--slab-shell")) < 0.15 ? 0.75 : 0.45;
  }

  // Aleja la cámara lo justo para que quepa la funda (o la carta sola) en cualquier proporción.
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    R.setSize(w, h, false);
    cam.aspect = w / h;
    const k = Math.tan((cam.fov * Math.PI) / 360);
    const spec = GRADERS[grader].slab;
    const oh = slabOn ? spec.h + 0.45 : 3.95, ow = slabOn ? spec.w + 0.42 : 2.95;
    cam.position.set(0, 0, Math.max(oh / 2 / k, ow / 2 / k / cam.aspect));
    cam.updateProjectionMatrix();
  }
  function layout() {
    slab.visible = slabOn;
    const spec = GRADERS[grader].slab;
    card.position.y = slabOn ? cardInSlabY : 0;
    shadow.scale.set(slabOn ? spec.w * 1.45 : 3.6, slabOn ? spec.h * 1.2 : 4.6, 1);
    resize();
  }

  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(stage);
  const dark = matchMedia("(prefers-color-scheme: dark)");
  dark.addEventListener("change", theme);
  const themeObs = new MutationObserver(theme);
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ---- Interacción ----
  // Arrastre con inercia, teclado, doble clic, inclinación al pasar el ratón y balanceo en reposo.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let rx = -0.08, ry = 0.35, vx = 0, vy = 0, drag = false, lx = 0, ly = 0, idleAt = 0;
  // inclinación por ratón: objetivo (hx, hy) y valor suavizado (ox, oy), sumados a la rotación
  let hx = 0, hy = 0, ox = 0, oy = 0;
  const el = R.domElement;
  const onDown = (e: PointerEvent) => {
    drag = true; lx = e.clientX; ly = e.clientY; vx = vy = 0;
    el.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) {
      // solo con ratón (en táctil no hay "pasar por encima")
      if (e.pointerType === "mouse" && !reduce.matches) {
        const b = el.getBoundingClientRect();
        hx = clamp(((e.clientY - b.top) / b.height - 0.5) * 2, -1, 1) * 0.16;
        hy = clamp(((e.clientX - b.left) / b.width - 0.5) * 2, -1, 1) * 0.26;
        idleAt = performance.now();
      }
      return;
    }
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    vy = dx * 0.011; vx = dy * 0.011;
    ry += vy; rx = clamp(rx + vx, -0.9, 0.9);
  };
  const onUp = () => { drag = false; idleAt = performance.now(); };
  const onLeave = () => { hx = hy = 0; };
  const reset = () => { vx = vy = rx = ry = 0; idleAt = performance.now(); };
  const onKey = (e: KeyboardEvent) => {
    const s = 0.2;
    if (e.key === "ArrowLeft") ry -= s;
    else if (e.key === "ArrowRight") ry += s;
    else if (e.key === "ArrowUp") rx = clamp(rx - s, -0.9, 0.9);
    else if (e.key === "ArrowDown") rx = clamp(rx + s, -0.9, 0.9);
    else if (e.key === "Home") { rx = ry = 0; }
    else return;
    e.preventDefault();
    vx = vy = 0; idleAt = performance.now();
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("pointerleave", onLeave);
  el.addEventListener("dblclick", reset);
  stage.addEventListener("keydown", onKey);

  const tv = new THREE.Vector2();
  let raf = 0;
  function frame(t: number) {
    raf = requestAnimationFrame(frame);
    if (!drag) {
      ry += vy; rx = clamp(rx + vx, -0.9, 0.9);
      vx *= 0.93; vy *= 0.93;
      // balanceo en reposo (se desactiva con prefers-reduced-motion)
      if (!reduce.matches && Math.abs(vy) < 0.0008 && t - idleAt > 4000) {
        ry = Math.atan2(Math.sin(ry), Math.cos(ry));
        ry += (Math.sin(t * 0.00045) * 0.38 - ry) * 0.015;
        rx += (Math.cos(t * 0.00037) * 0.1 - 0.05 - rx) * 0.015;
      }
    }
    ox += (hx - ox) * 0.08;
    oy += (hy - oy) * 0.08;
    const ax = rx + ox, ay = ry + oy;
    root.rotation.set(ax, ay, 0);
    shadow.position.x = -Math.sin(ay) * 0.35;
    shadow.position.y = Math.sin(ax) * 0.35 - 0.12;
    tv.set(Math.sin(ay), Math.sin(ax));
    frontMat.uniforms.tilt.value.copy(tv);
    glareMat.uniforms.tilt.value.copy(tv);
    R.render(scene, cam);
  }

  buildSlab(); drawFront(); drawBack(); drawLabel(); theme(); layout();
  raf = requestAnimationFrame(frame);

  return {
    setCard(c) { cur = c; scanImg = null; cardImg = null; holo(); drawFront(); drawLabel(); },
    updateCard(c) { cur = c; drawFront(); drawLabel(); },
    setFoil(m) { frontMat.uniforms.mode.value = FOIL_CODE[m]; },
    setStamp(st) { stamp = st; drawFront(); },
    setBack(img, inset = 0) { backImg = img; backInset = inset; drawBack(); },
    setCardImage(img) { cardImg = img; holo(); drawFront(); },
    setScan(img) { scanImg = img; holo(); drawFront(); },
    setSlab(on) { slabOn = on; layout(); },
    setGrader(g, id) { grader = g; gradeId = id; buildSlab(); drawLabel(); layout(); },
    setGrade(id) { gradeId = id; drawLabel(); },
    reset,
    redraw() { drawFront(); drawBack(); drawLabel(); },
    dispose() {
      cancelAnimationFrame(raf);
      resizeObs.disconnect();
      themeObs.disconnect();
      dark.removeEventListener("change", theme);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("dblclick", reset);
      stage.removeEventListener("keydown", onKey);
      [faceGeo, edgeGeo, shadowGeo, ...slabGeos].forEach((g) => g.dispose());
      [frontMat, backMat, capMat, sideMat, shellMat, edgeMat, wellMat, insertMat, glareMat, labelMat, shadowMat].forEach((m) => m.dispose());
      [F.t, B.t, L.t, shadowTex].forEach((t) => t.dispose());
      envTex?.dispose();
      R.dispose();
      el.remove();
    },
  };
}

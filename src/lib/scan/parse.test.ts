import { describe, expect, it } from "vitest";
import { readBottom, readCard, readName, scanQueries } from "./parse";

// Textos reales devueltos por Tesseract sobre imágenes de cartas (ver Scanner: grises / umbral).
const PAF = {
  gray: "ness & )) AL fea AR Pokéma hs, 5 baal Gra phics BPAF re 054/091 | iaknedado 12",
  thr: "weakness - | resistance “ Pokémo 11lus¥5bon) rd 74 [3 [PAF ur] ry 4 054/091 he 52 Nie",
};
const JP = {
  gray: "be abo | al od &.x ARQ ey ap — Ny Sri ak ex/u— luss PLA ETA{Mo — \\ rE SEK] ~X7 22 40 (sv2a; 006/165",
  thr: "3: aL Rs) RAKE I, © cn AR SEALY, aa ay [EVN 11 LANETAIM zuki ha A=X292 RTE B(sv20] 006/165'RR",
};
const OBF = {
  gray: "Ww \\/ 4 Jresistanc 7 Pokéma [1110595 ba raphics Cod [i (3; 08F av) re/ 125/197 X A fils Sack",
  thr: "| resistance weakness ie 4 2 PA 77 i1fus%5 ban) : Pokéme (3, 08F i] ey 4",
};

describe("readBottom: código y número con textos reales del OCR", () => {
  it("Paldean Fates 054: el umbral lee PAF; de 'BPAF' también sale PAF", () => {
    const r = readBottom([PAF.thr, PAF.gray]);
    expect(r.number).toBe("054");
    expect(r.total).toBe("091");
    expect(r.setCode).toBe("PAF");
    expect(r.setCodes).toContain("PAF");
  });
  it("japonesa SV2a 006: acepta el código en minúscula", () => {
    const r = readBottom([JP.thr, JP.gray]);
    expect(r.number).toBe("006");
    expect(r.setCodes).toContain("sv2a");
  });
  it("Obsidian Flames 125: '08F' se corrige a OBF y el número sale de la otra versión", () => {
    const r = readBottom([OBF.thr, OBF.gray]);
    expect(r.number).toBe("125");
    expect(r.total).toBe("197");
    expect(r.setCodes).toContain("OBF");
  });
  it("corrige O por 0 y l por 1 en el número", () => {
    expect(readBottom("OBF EN O5l/197")).toMatchObject({ number: "051", total: "197" });
  });
  it("no toma el idioma, rarezas ni palabras en minúscula como código", () => {
    expect(readBottom("re rd EN RR 054/091").setCodes).toEqual([]);
  });
  it("sin número legible", () => {
    expect(readBottom("garabatos ilegibles")).toMatchObject({ number: null, total: null });
  });
});

describe("readName: nombre", () => {
  it("quita la vida y la fase", () => {
    expect(readName("BASIC Pikachu 60 HP")).toBe("Pikachu");
    expect(readName("STAGE 2\nCharizard ex 330 HP")).toBe("Charizard ex");
  });
  it("el 'ex' estilizado que el OCR lee como @X o @¥", () => {
    expect(readName('"Charizard @¥ ‘5')).toBe("Charizard ex");
    expect(readName("Charizard@X #43")).toBe("Charizard ex");
  });
  it("carta antigua: ignora 'Evolves from' y la regla de la fase", () => {
    expect(readName("2 Evolves from Charmeleon Put Charizard on the Charizard 120 Ek")).toBe("Charizard");
  });
  it("sufijos y prefijos que son parte del nombre", () => {
    expect(readName("~ | 12\nUmbreon VMAX 310 HP")).toBe("Umbreon VMAX");
    expect(readName("Dark Charizard 60 HP")).toBe("Dark Charizard");
  });
  it("nada legible", () => expect(readName("12 / ||")).toBeNull());
});

describe("scanQueries", () => {
  it("cada candidato de código con el número, luego nombre + número, luego nombre", () => {
    const r = readCard([PAF.thr, PAF.gray], '"Charizard @¥ ‘5');
    const q = scanQueries(r);
    expect(q[0]).toEqual({ q: "PAF 054", set: true });
    expect(q).toContainEqual({ q: "Charizard ex 054/091", set: false });
    expect(q.at(-1)).toEqual({ q: "Charizard ex", set: false });
    // todas las de código exigen colección reconocida
    expect(q.filter((x) => x.set).every((x) => /054$/.test(x.q))).toBe(true);
  });
  it("carta antigua sin código ni número: solo el nombre", () => {
    const r = readCard("LV.76 #6", "2 Evolves from Charmeleon Put Charizard on the Charizard 120 Ek");
    expect(scanQueries(r)).toEqual([{ q: "Charizard", set: false }]);
  });
  it("sin nada útil, sin búsquedas", () => {
    expect(scanQueries({ setCode: null, setCodes: [], number: null, total: null, name: null })).toEqual([]);
  });
});

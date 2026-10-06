import { describe, expect, it } from "vitest";
import { GRADERS, GRADER_IDS, bgsSubgrades, carryGrade, gradeOption, labelColors } from "./companies";

describe("empresas de gradeo", () => {
  it("PSA, BGS, CGC, SGC y TAG", () => expect(GRADER_IDS).toEqual(["PSA", "BGS", "CGC", "SGC", "TAG"]));

  it("cada funda es más grande que la carta y deja sitio para la etiqueta", () => {
    for (const id of GRADER_IDS) {
      const s = GRADERS[id].slab;
      expect(s.w).toBeGreaterThan(2.5 + 0.3);
      // margen superior + etiqueta + separación + carta + margen inferior
      expect(s.h).toBeGreaterThanOrEqual(0.16 + s.labelH + 0.13 + 3.5 + 0.16);
    }
  });

  it("BGS es la más gruesa, con funda interior; SGC lleva marco negro", () => {
    const depth = GRADER_IDS.map((id) => GRADERS[id].slab.d);
    expect(GRADERS.BGS.slab.d).toBe(Math.max(...depth));
    expect(GRADERS.BGS.slab.insert).toBe("sleeve");
    expect(GRADERS.SGC.slab.insert).toBe("black");
  });

  it("las notas con precio existen en la escala de cada empresa", () => {
    for (const id of GRADER_IDS) {
      const values = GRADERS[id].grades.map((g) => g.value);
      for (const v of GRADERS[id].priceGrades) expect(values).toContain(v);
    }
  });

  it("escalas de mayor a menor y con ids únicos", () => {
    for (const id of GRADER_IDS) {
      const vals = GRADERS[id].grades.map((g) => g.value);
      expect(vals).toEqual([...vals].sort((a, b) => b - a));
      const ids = GRADERS[id].grades.map((g) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("cambiar de empresa conserva la nota si existe", () => {
  it("10 de PSA -> 10 de BGS (Pristine en BGS)", () => expect(carryGrade("BGS", "10")).toBe("10"));
  it("9.5 de BGS -> PSA no tiene medios puntos: la más alta", () => expect(carryGrade("PSA", "9.5")).toBe("10"));
  it("Pristine de CGC -> SGC también la tiene", () => expect(carryGrade("SGC", "p10")).toBe("p10"));
  it("Pristine de CGC -> PSA no: la más alta", () => expect(carryGrade("PSA", "p10")).toBe("10"));
  it("gradeOption con un id desconocido da la nota más alta", () => expect(gradeOption("PSA", "nope").id).toBe("10"));
});

describe("color de la etiqueta", () => {
  it("BGS: negra para el 10, oro para el 9.5, plata para el resto", () => {
    expect(labelColors(GRADERS.BGS, gradeOption("BGS", "10")).bg).toBe("#141416");
    expect(labelColors(GRADERS.BGS, gradeOption("BGS", "9.5")).bg).toBe("#d9b866");
    expect(labelColors(GRADERS.BGS, gradeOption("BGS", "9")).bg).toBe(GRADERS.BGS.label.bg);
  });
  it("Pristine en CGC: banda dorada; el resto, su banda de siempre", () => {
    expect(labelColors(GRADERS.CGC, gradeOption("CGC", "p10")).accent).toBe("#c9a24a");
    expect(labelColors(GRADERS.CGC, gradeOption("CGC", "10")).accent).toBe(GRADERS.CGC.label.accent);
  });
  it("PSA: siempre blanca con marco rojo", () => {
    const c = labelColors(GRADERS.PSA, gradeOption("PSA", "10"));
    expect([c.layout, c.bg, c.accent]).toEqual(["frame", "#ffffff", "#c8202a"]);
  });
});

describe("subnotas de BGS", () => {
  it("coherentes con la nota final", () => {
    expect(bgsSubgrades(10)).toEqual([10, 10, 10, 10]);
    expect(bgsSubgrades(9.5)).toEqual([9.5, 9.5, 10, 9.5]);
    expect(bgsSubgrades(8)).toEqual([8, 8, 8, 8]);
  });
});

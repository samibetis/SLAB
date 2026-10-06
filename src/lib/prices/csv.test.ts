import { describe, expect, it } from "vitest";
import { CsvImportProvider, normDate, parseCsv, splitLine } from "./csv";
import { pointsToSeries } from "./series";

const ctx = { cardId: "en-base1-4", variant: "holo-unlimited", source: "csv" };

describe("normDate", () => {
  it("AAAA-MM -> primer día del mes", () => expect(normDate("2025-3")).toBe("2025-03-01"));
  it("AAAA-MM-DD se conserva", () => expect(normDate("2025-03-14")).toBe("2025-03-14"));
  it("acepta / y . como separador y comillas", () => {
    expect(normDate('"2025/03/14"')).toBe("2025-03-14");
    expect(normDate("2025.03")).toBe("2025-03-01");
  });
  it("DD/MM/AAAA", () => expect(normDate("14/03/2025")).toBe("2025-03-14"));
  it("rechaza lo que no es fecha o es imposible", () => {
    expect(normDate("marzo")).toBeNull();
    expect(normDate("2025-13")).toBeNull();
    expect(normDate("")).toBeNull();
  });
});

describe("splitLine", () => {
  it("respeta las comillas: el separador dentro de un campo no parte", () => {
    expect(splitLine('2025-01,"$1,234.50",5', ",")).toEqual(["2025-01", "$1,234.50", "5"]);
  });
  it("comilla doble escapada y campos vacíos", () => {
    expect(splitLine('a,"di ""hola""",,b', ",")).toEqual(["a", 'di "hola"', "", "b"]);
  });
  it("con punto y coma", () => expect(splitLine('x;"1;5";y', ";")).toEqual(["x", "1;5", "y"]));
});

describe("parseCsv", () => {
  it("columnas fecha, raw, psa7..psa10", () => {
    const r = parseCsv("fecha,raw,psa7,psa8,psa9,psa10\n2025-01,100,150,200,400,1000\n2025-02,110,,210,420,1100", ctx);
    expect(r.rows).toBe(2);
    expect(r.points).toHaveLength(9); // el hueco de psa7 en febrero no cuenta
    const raw = r.points.find((p) => p.grader === "RAW")!;
    expect(raw).toMatchObject({ grade: null, price: 100, date: "2025-01-01", currency: "USD", source: "csv", cardId: "en-base1-4", variant: "holo-unlimited" });
    expect(r.points.find((p) => p.grader === "PSA" && p.grade === 10)!.price).toBe(1000);
  });
  it("el orden de las columnas da igual y las que faltan se ignoran", () => {
    const r = parseCsv("psa10,date\n900,2025-05", ctx);
    expect(r.points).toEqual([expect.objectContaining({ grader: "PSA", grade: 10, price: 900, date: "2025-05-01" })]);
  });
  it("punto y coma con decimales en coma y miles con punto", () => {
    const r = parseCsv("fecha;raw\n2025-01;1.234,50\n2025-02;99,9", ctx);
    expect(r.points.map((p) => p.price)).toEqual([1234.5, 99.9]);
  });
  it("coma como separador: quita las comas de miles y símbolos de moneda", () => {
    const r = parseCsv('date,raw\n2025-01,"$1,234.50"\n2025-02,€80', ctx);
    expect(r.points.map((p) => p.price)).toEqual([1234.5, 80]);
  });
  it("tabulador, BOM y finales de línea de Windows", () => {
    const r = parseCsv("﻿date\traw\r\n2025-01\t10\r\n2025-02\t12\r\n", ctx);
    expect(r.points.map((p) => p.price)).toEqual([10, 12]);
  });
  it("alias de cabecera: ungraded -> raw, grade 10 -> psa10, mes -> fecha", () => {
    const r = parseCsv("Mes,Ungraded,Grade 10\n2025-01,5,50", ctx);
    expect(r.points.map((p) => [p.grader, p.grade, p.price])).toEqual([["RAW", null, 5], ["PSA", 10, 50]]);
  });
  it("cuenta las filas sin fecha válida", () => {
    const r = parseCsv("fecha,raw\n2025-01,10\nbasura,20\n2025-02,30", ctx);
    expect(r.rows).toBe(3);
    expect(r.skipped).toBe(1);
    expect(r.points).toHaveLength(2);
  });
  it("precios no positivos o ilegibles se ignoran", () => {
    expect(parseCsv("fecha,raw\n2025-01,0\n2025-02,-5\n2025-03,abc", ctx).points).toHaveLength(0);
  });
  it("sin columna de fecha o sin filas: vacío", () => {
    expect(parseCsv("raw,psa10\n1,2", ctx).points).toEqual([]);
    expect(parseCsv("fecha,raw", ctx).points).toEqual([]);
    expect(parseCsv("", ctx).points).toEqual([]);
  });
  it("las ventas del mismo mes se promedian al construir la serie", () => {
    const { points } = parseCsv("fecha,raw\n2025-01-03,100\n2025-01-20,200\n2025-02-10,50", ctx);
    const series = pointsToSeries(points);
    expect(series.map((r) => [r.t, r.p.raw])).toEqual([["2025-01", 150], ["2025-02", 50]]);
  });
});

describe("CsvImportProvider", () => {
  it("devuelve los puntos de la carta y versión pedidas, con fuente csv", async () => {
    const prov = new CsvImportProvider("fecha,raw\n2025-01,10", "mis-ventas.csv");
    expect(prov.synthetic).toBe(false);
    expect(prov.label).toContain("mis-ventas.csv");
    const pts = await prov.getHistory({ card: { id: "x", name: "X" }, variant: "v" });
    expect(pts).toEqual([expect.objectContaining({ cardId: "x", variant: "v", source: "csv", price: 10 })]);
  });
});

import { DEFAULT_GRADER, GRADERS, GRADER_IDS, type GraderId } from "@/lib/grading/companies";

// Los grados son datos: raw más las notas con precio de cada empresa (PSA 7-10; BGS, CGC, SGC y TAG
// 8.5-10). Salen de GRADERS, así que añadir una empresa o una nota es tocar solo esa tabla.
export interface GradeDef {
  key: string; // "raw", "psa10", "bgs9.5"
  grader: string; // RAW | PSA | BGS | CGC | SGC | TAG
  grade: number | null;
  label: string;
  color: string; // variable CSS del color de su línea
}

const RAW: GradeDef = { key: "raw", grader: "RAW", grade: null, label: "Raw", color: "--g-raw" };
// Cuatro tonos de menor a mayor nota, los mismos para todas las empresas.
const TONES = ["--g-7", "--g-8", "--g-9", "--g-10"];

export const gradeKey = (grader: string, grade: number | null) =>
  grader.toUpperCase() === "RAW" || grade === null ? "raw" : `${grader.toLowerCase()}${grade}`;

const forGrader = (id: GraderId): GradeDef[] =>
  GRADERS[id].priceGrades.map((grade, i, all) => ({
    key: gradeKey(id, grade),
    grader: id,
    grade,
    label: `${id} ${grade}`,
    color: TONES[TONES.length - all.length + i] ?? TONES[i],
  }));

// Todos los grados conocidos (series, CSV, base de datos).
export const GRADES: GradeDef[] = [RAW, ...GRADER_IDS.flatMap(forGrader)];

// Los que se enseñan con una empresa elegida: raw y sus notas.
export const gradesFor = (id: GraderId = DEFAULT_GRADER): GradeDef[] => [RAW, ...forGrader(id)];

export const gradeByKey = (key: string) => GRADES.find((g) => g.key === key);

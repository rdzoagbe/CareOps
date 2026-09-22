/**
 * The wall between the back office and the care side.
 *
 * CareOps holds two kinds of data with two different sets of obligations.
 * Payroll data and health data must not end up in one another's screens, one
 * another's stores, or one another's hosting — and the only way that stays
 * true as the codebase grows is if the import graph itself forbids it.
 *
 * So: this test reads every source file and checks who imports whom. It is
 * deliberately a source-level test, like `prototype.test.ts`, because the
 * property is about the shape of the codebase rather than about a value at
 * runtime.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SRC = resolve(__dirname);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

interface Imported {
  file: string;
  from: string;
  names: string[];
}

const IMPORT = /import\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']/g;

function importsOf(file: string): Imported[] {
  const src = readFileSync(file, "utf8");
  const out: Imported[] = [];
  for (const m of src.matchAll(IMPORT)) {
    const clause = m[2] ?? "";
    const names = [...clause.matchAll(/[A-Za-z_$][\w$]*/g)]
      .map((x) => x[0])
      .filter((n) => n !== "type" && n !== "as");
    out.push({ file: relative(SRC, file), from: m[3], names });
  }
  return out;
}

const files = sourceFiles(SRC);
const graph = files.flatMap(importsOf);

/** The composition root is the one place that may see both sides. */
const ROOTS = ["App.tsx", "main.tsx"];

const under = (f: string, ...dirs: string[]) => dirs.some((d) => f.startsWith(d + "/"));

describe("the back office cannot reach patient data", () => {
  it("has no import of the care side from any back-office module", () => {
    const offenders = graph.filter(
      (i) =>
        !ROOTS.includes(i.file) &&
        under(i.file, "data", "console", "employee", "ai", "state") &&
        /(^|\/)(clinical|patient)(\/|$)/.test(i.from.replace(/^@\//, "")),
    );
    expect(offenders.map((o) => `${o.file} -> ${o.from}`)).toEqual([]);
  });

  it("keeps the two repositories separate", () => {
    // Neither snapshot may carry the other's data, or hosting them apart later
    // stops being possible. Checked on the import graph rather than on the
    // prose: a comment mentioning payroll is not a leak, an import is.
    const care = importsOf(join(SRC, "clinical/data/repository.ts")).map((i) => i.from);
    expect(care.filter((f) => /^@\/(data|state|console|employee|ai)/.test(f))).toEqual([]);

    const backOffice = importsOf(join(SRC, "data/repository.ts")).map((i) => i.from);
    expect(backOffice.filter((f) => /clinical|patient/.test(f))).toEqual([]);
  });

  it("keeps the back-office store free of any care state", () => {
    const store = importsOf(join(SRC, "state/store.tsx"));
    expect(store.map((i) => i.from).filter((f) => /clinical|patient/.test(f))).toEqual([]);
    // And no care type reached it through a shared module either.
    const named = store.flatMap((i) => i.names);
    for (const t of ["Patient", "Prescription", "Diagnosis", "ClinicalDataset", "CareRole"]) {
      expect(named).not.toContain(t);
    }
  });
});

/**
 * The care side may use shared *helpers* — dates and number formatting are not
 * personal data — and the list of sites, which is organisational. Nothing else.
 */
const ALLOWED_FROM_BACK_OFFICE: Record<string, "any" | string[]> = {
  "@/data/dates": "any",
  "@/data/format": "any",
  "@/data/constants": ["FACILITIES", "DEPTS"],
};

describe("the care side reaches only shared helpers", () => {
  it("imports nothing else from the back office", () => {
    const offenders = graph
      .filter((i) => under(i.file, "clinical", "patient") && /^@\/(data|state|console|employee|ai)/.test(i.from))
      .filter((i) => {
        const rule = ALLOWED_FROM_BACK_OFFICE[i.from];
        if (!rule) return true;
        if (rule === "any") return false;
        return i.names.some((n) => !rule.includes(n));
      });
    expect(offenders.map((o) => `${o.file} -> ${o.from} (${o.names.join(", ")})`)).toEqual([]);
  });

  it("never imports the back-office barrel, which re-exports everything", () => {
    const offenders = graph.filter(
      (i) => under(i.file, "clinical", "patient") && (i.from === "@/data" || i.from === "@/state/store"),
    );
    expect(offenders.map((o) => `${o.file} -> ${o.from}`)).toEqual([]);
  });
});

describe("the wall is worth having", () => {
  it("actually has files on both sides of it", () => {
    // A wall between an empty room and an empty room proves nothing.
    expect(files.filter((f) => relative(SRC, f).startsWith("clinical/")).length).toBeGreaterThan(4);
    expect(files.filter((f) => relative(SRC, f).startsWith("console/")).length).toBeGreaterThan(4);
  });
});

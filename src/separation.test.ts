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

/**
 * The composition roots: the only places that may see both sides.
 *
 * `directory/state.tsx` is the second one, and it is allowed for a specific
 * reason. The same human is an employee record and a clinician record, and
 * something has to know they are one person — that is the directory's whole
 * job. What keeps it honest is not the import graph but its output, which
 * carries no salary and nothing clinical: `directory.test.ts` asserts that,
 * and it is the guarantee that actually matters.
 */
const ROOTS = ["App.tsx", "main.tsx", "directory/state.tsx"];

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

describe("the directory is a join, not a third copy", () => {
  it("builds from narrow records, importing neither side", () => {
    // Everything but the provider must be reachable without touching either
    // dataset, which is what makes the directory testable on its own.
    for (const file of ["directory/build.ts", "directory/roles.ts", "directory/types.ts"]) {
      const froms = importsOf(join(SRC, file)).map((i) => i.from);
      expect(froms.filter((f) => /clinical|patient/.test(f))).toEqual([]);
      expect(froms.filter((f) => /^@\/(data|state|console|employee|ai)/.test(f) && f !== "@/data/dates" && f !== "@/data/format")).toEqual([]);
    }
  });

  it("and App are the only two places that touch both", () => {
    const both = files.filter((f) => {
      const froms = importsOf(f).map((i) => i.from);
      return froms.some((x) => /^@\/clinical/.test(x)) && froms.some((x) => /^@\/data\/repository|^@\/state/.test(x));
    });
    expect(both.map((f) => relative(SRC, f)).sort()).toEqual(["App.tsx", "directory/state.tsx"]);
  });
});

describe("the join asks for no more than it needs", () => {
  // Found in review: the provider called `load()` and used one field of the
  // snapshot, leaving every patient record resident in a back-office page.
  // Behind an HTTP repository that is an HR user's browser fetching the
  // patient record set, so the seam itself is narrowed rather than the usage.
  it("reads the clinician roster, never the clinical snapshot", () => {
    const src = readFileSync(join(SRC, "directory/state.tsx"), "utf8");
    expect(src).toContain("defaultClinicalRepository.loadClinicians()");
    expect(src).not.toMatch(/defaultClinicalRepository\.load\(\)/);
  });

  it("offers a roster accessor that cannot return a patient", () => {
    const repo = readFileSync(join(SRC, "clinical/data/repository.ts"), "utf8");
    expect(repo).toContain("loadClinicians(): Promise<ClinicianRecord[]>");
    // The record it returns carries no patient-bearing field.
    const shape = repo.slice(repo.indexOf("export interface ClinicianRecord"));
    const body = shape.slice(0, shape.indexOf("}"));
    for (const forbidden of ["patient", "careTeam", "diagnos", "prescription"]) {
      expect(body.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("renders the redacted patient, not the one the component was handed", () => {
    // The overview tab read the `patient` prop while every other tab read the
    // view. Equivalent today, because every role may read identity — but it
    // would leak the moment a profession is given `identity: "none"`.
    const src = readFileSync(join(SRC, "clinical/PatientRecord.tsx"), "utf8");
    for (const field of ["ins", "allergies", "consent.trustedPerson", "born", "admitted"]) {
      expect(src).not.toMatch(new RegExp(`[^.]\\bpatient\\.${field.replace(".", "\\.")}`));
    }
    expect(src).toContain("view.patient.ins");
  });
});

describe("the wall is worth having", () => {
  it("actually has files on both sides of it", () => {
    // A wall between an empty room and an empty room proves nothing.
    expect(files.filter((f) => relative(SRC, f).startsWith("clinical/")).length).toBeGreaterThan(4);
    expect(files.filter((f) => relative(SRC, f).startsWith("console/")).length).toBeGreaterThan(4);
  });
});

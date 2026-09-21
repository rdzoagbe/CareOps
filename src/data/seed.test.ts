import { describe, expect, it } from "vitest";
import { buildSnapshot } from "./repository";
import { buildDataset } from "./seed";
import { periodBudget, PERIODS, scoped, ALL_FACILITIES, facilityName } from "./filters";
import { renOpen, renState, RTYPE, STORY_IDX } from "./portal";
import { daysTo } from "./dates";

const snapshot = buildSnapshot();
const { db, renewals, portal } = snapshot;

describe("dataset shape", () => {
  it("generates the documented record counts", () => {
    expect(db.employees).toHaveLength(1284);
    expect(db.suppliers).toHaveLength(187);
    expect(db.pos).toHaveLength(246);
    expect(db.invoices).toHaveLength(428);
    expect(db.assets).toHaveLength(1840);
    expect(db.documents).toHaveLength(965);
    expect(db.events).toHaveLength(2841);
    expect(db.budgets).toHaveLength(db.facilities.length * db.depts.length);
    expect(db.findings).toHaveLength(17);
    expect(db.workflows).toHaveLength(8);
  });

  it("is deterministic: the same seed produces the same data twice", () => {
    const a = buildDataset();
    const b = buildDataset();
    expect(a.employees[0]).toEqual(b.employees[0]);
    expect(a.employees.at(-1)).toEqual(b.employees.at(-1));
    expect(a.invoices.map((i) => i.amount)).toEqual(b.invoices.map((i) => i.amount));
    expect(a.assets.at(-1)).toEqual(b.assets.at(-1));
  });

  it("gives every record a unique id", () => {
    for (const rows of [db.employees, db.suppliers, db.pos, db.invoices, db.assets, db.documents, db.events]) {
      const ids = new Set(rows.map((r) => (r as { id: string }).id));
      expect(ids.size).toBe(rows.length);
    }
  });

  it("points every foreign key at a record that exists", () => {
    const supplierIds = new Set(db.suppliers.map((s) => s.id));
    const poIds = new Set(db.pos.map((p) => p.id));
    const employeeIds = new Set(db.employees.map((e) => e.id));

    expect(db.invoices.every((v) => supplierIds.has(v.supplier))).toBe(true);
    expect(db.invoices.every((v) => v.po === null || poIds.has(v.po))).toBe(true);
    expect(db.pos.every((p) => supplierIds.has(p.supplier))).toBe(true);
    expect(db.pos.every((p) => employeeIds.has(p.requester))).toBe(true);
    expect(db.assets.every((a) => supplierIds.has(a.supplier))).toBe(true);
  });
});

describe("reconciliation", () => {
  it("reconciles supplier spend to the invoice ledger, to the cent", () => {
    const ledger = db.invoices.reduce((s, v) => s + v.amount, 0);
    const rolledUp = db.suppliers.reduce((s, x) => s + x.spend, 0);
    expect(rolledUp).toBe(ledger);
  });

  it("reconciles invoice counts and disputes to the ledger", () => {
    expect(db.suppliers.reduce((s, x) => s + x.invCount, 0)).toBe(db.invoices.length);
    expect(db.suppliers.reduce((s, x) => s + x.poCount, 0)).toBe(db.pos.length);
    expect(db.suppliers.reduce((s, x) => s + x.disputes, 0)).toBe(
      db.invoices.filter((v) => v.exception).length,
    );
  });

  it("keeps the matched flag the exact inverse of an exception", () => {
    expect(db.invoices.every((v) => v.matched === !v.exception)).toBe(true);
    expect(db.invoices.every((v) => (v.exception ? v.status === "Exception" : v.status !== "Exception"))).toBe(true);
  });

  it("reconciles twelve months of budget actuals to the stored annual actual", () => {
    const { actual } = periodBudget(db.budgets, "r12");
    const stored = db.budgets.reduce((s, b) => s + b.actual, 0);
    expect(actual).toBe(stored);
  });

  it("splits the year into periods that never exceed the full year", () => {
    const year = periodBudget(db.budgets, "r12").actual;
    for (const key of Object.keys(PERIODS) as (keyof typeof PERIODS)[]) {
      expect(periodBudget(db.budgets, key).actual).toBeLessThanOrEqual(year);
    }
    expect(periodBudget(db.budgets, "sep").actual).toBeGreaterThan(0);
  });
});

describe("scoping by facility", () => {
  it("returns every record when no facility is selected", () => {
    const all = scoped(db, { facility: ALL_FACILITIES, period: "r12" });
    expect(all.employees).toHaveLength(db.employees.length);
    expect(all.assets).toHaveLength(db.assets.length);
  });

  it("partitions employees across facilities without loss", () => {
    const perFacility = db.facilities
      .map((f) => scoped(db, { facility: f.id, period: "r12" }).employees.length)
      .reduce((a, b) => a + b, 0);
    expect(perFacility).toBe(db.employees.length);
  });

  it("names facilities, including the all-facilities case", () => {
    expect(facilityName(db.facilities, ALL_FACILITIES)).toBe("All facilities");
    expect(facilityName(db.facilities, "PAR")).toBe("St. Gabriel Paris Central");
  });
});

describe("storyline employees", () => {
  it("replaces two existing records rather than adding any, so headcount is unchanged", () => {
    expect(db.employees).toHaveLength(1284);
    expect(db.employees[STORY_IDX.A].name).toBe("Aïcha Diallo");
    expect(db.employees[STORY_IDX.M].name).toBe("Marc Lefèvre");
  });

  it("starts Aïcha invited and Marc active", () => {
    expect(portal.ppl.A.account).toBe("invited");
    expect(portal.ppl.M.account).toBe("active");
  });

  it("starts the contract unsigned, because silence is never acceptance", () => {
    expect(portal.contract.status).toBe("Sent");
    expect(portal.contract.signed).toBeNull();
    expect(portal.contract.versions).toHaveLength(1);
  });
});

describe("renewals register", () => {
  it("attaches every renewal to an employee that exists", () => {
    const ids = new Set(db.employees.map((e) => e.id));
    expect(renewals.every((r) => ids.has(r.emp))).toBe(true);
  });

  it("knows every renewal type", () => {
    expect(renewals.every((r) => RTYPE[r.type] !== undefined)).toBe(true);
  });

  it("treats an item outside its lead window as valid, not as action needed", () => {
    for (const r of renewals) {
      if (r.status === "To act" && daysTo(r.due) > RTYPE[r.type].lead) {
        expect(renState(r)).toBe("Valid");
      }
    }
  });

  it("closes only verified, ended and offline items", () => {
    expect(renewals.filter((r) => !renOpen(r)).every((r) =>
      ["Verified", "Ends as planned", "Handled offline"].includes(r.status))).toBe(true);
  });

  it("gives the two storyline employees renewals that reach a phone", () => {
    const withPhone = renewals.filter((r) => r.who);
    expect(withPhone.length).toBe(7);
    expect(withPhone.filter((r) => r.who === "A")).toHaveLength(4);
    expect(withPhone.filter((r) => r.who === "M")).toHaveLength(3);
  });

  it("tracks right to work from 120 days out, and keeps it HR only", () => {
    expect(RTYPE.work.lead).toBe(120);
    expect(RTYPE.work.hr).toBe(true);
    expect(RTYPE.id.hr).toBe(true);
  });
});

describe("no clinical data", () => {
  it("has no field that could carry a medical reason", () => {
    const serialised = JSON.stringify(db.employees.slice(0, 200));
    for (const banned of ["diagnosis", "patient", "medicalReason", "illness", "nhsNumber"]) {
      expect(serialised.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});

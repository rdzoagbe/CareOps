/**
 * The care dataset, and the line the product does not cross.
 *
 * The second half of this file is about EU 2017/745. CareOps records a
 * prescription a prescriber decided on. The moment it suggests a drug,
 * calculates a dose, or warns about an interaction, it is doing a different
 * job and is regulated as a different kind of product. The strongest way to
 * hold that line is not a policy: it is to hold no data that could drive such
 * a check, and that is what these tests pin.
 */
import { describe, expect, it } from "vitest";
import {
  ADMIN_NOTES, ADMISSION_REASONS, CARE_ROLES, CARE_SERVICES, DEMO_INS_PREFIX, FORMULARY,
  NURSE_NOTES, REHAB_NOTES, buildClinicalDataset,
} from "./repository";
import { FACILITIES } from "@/data/constants";
import { daysTo } from "@/data/dates";

const db = buildClinicalDataset();
const clinicianById = new Map(db.clinicians.map((c) => [c.id, c]));
const patientById = new Map(db.patients.map((p) => [p.id, p]));
const formularyByDrug = new Map(FORMULARY.map((f) => [f.drug, f]));

describe("the care dataset", () => {
  it("is deterministic", () => {
    const again = buildClinicalDataset();
    expect(JSON.stringify(again)).toBe(JSON.stringify(db));
  });

  it("has patients, clinicians and a record for each", () => {
    expect(db.patients.length).toBeGreaterThan(40);
    expect(db.clinicians.length).toBeGreaterThan(100);
    expect(db.prescriptions.length).toBeGreaterThan(100);
    expect(db.observations.length).toBeGreaterThan(300);
  });

  it("marks every identifier so it cannot be taken for a real one", () => {
    for (const p of db.patients) {
      expect(p.ins.startsWith(DEMO_INS_PREFIX)).toBe(true);
      expect(p.ins).toMatch(/NOT-AN-INS/);
    }
    for (const c of db.clinicians) expect(c.registration).toMatch(/^DEMO-REG-/);
  });

  it("builds a care team that could actually exist", () => {
    for (const p of db.patients) {
      expect(p.careTeam.length).toBeGreaterThan(1);
      expect(new Set(p.careTeam).size).toBe(p.careTeam.length);
      const roles = new Set<string>();
      for (const id of p.careTeam) {
        const c = clinicianById.get(id);
        expect(c).toBeDefined();
        // Same site and same service: a team is not assembled across hospitals.
        expect(c!.facility).toBe(p.facility);
        expect(c!.service).toBe(p.service);
        roles.add(c!.role);
      }
      expect(roles.has("Doctor")).toBe(true);
      expect(roles.has("Nurse")).toBe(true);
    }
  });

  it("puts every patient in a real service at a real site, admitted in the past", () => {
    const sites = new Set(FACILITIES.map((f) => f.id));
    for (const p of db.patients) {
      expect(sites.has(p.facility)).toBe(true);
      expect(CARE_SERVICES).toContain(p.service);
      expect(ADMISSION_REASONS).toContain(p.reason);
      expect(daysTo(p.admitted)).toBeLessThanOrEqual(0);
    }
  });

  it("lets only a doctor prescribe", () => {
    for (const rx of db.prescriptions) {
      expect(clinicianById.get(rx.prescriber)!.role).toBe("Doctor");
      expect(patientById.has(rx.patient)).toBe(true);
    }
  });

  it("keeps every foreign key pointing somewhere", () => {
    for (const a of db.administrations) {
      expect(db.prescriptions.some((p) => p.id === a.prescription)).toBe(true);
      expect(clinicianById.get(a.by)!.role).toBe("Nurse");
    }
    for (const o of db.observations) {
      expect(patientById.has(o.patient)).toBe(true);
      expect(clinicianById.get(o.by)!.role).toBe(o.role);
    }
    for (const t of db.tasks) {
      expect(patientById.has(t.patient)).toBe(true);
      if (t.by) expect(clinicianById.get(t.by)!.role).toBe(t.role);
    }
    for (const a of db.access) {
      expect(patientById.has(a.patient)).toBe(true);
      expect(clinicianById.get(a.who)!.role).toBe(a.role);
    }
  });

  it("records an emergency access as an emergency, by someone off the team", () => {
    const emergencies = db.access.filter((a) => a.basis === "Emergency access");
    expect(emergencies.length).toBeGreaterThan(0);
    for (const a of emergencies) {
      expect(patientById.get(a.patient)!.careTeam).not.toContain(a.who);
      expect(a.reason.length).toBeGreaterThan(5);
    }
  });

  it("writes nothing in free text", () => {
    // Everything a person "wrote" in this demo came from a fixed list, which
    // is also how the screens work.
    for (const o of db.observations) {
      if (o.kind === "Note") expect(NURSE_NOTES).toContain(o.text);
      if (o.kind === "Rehab") expect(REHAB_NOTES).toContain(o.text);
      if (o.kind === "Vitals") expect(o.text).toBeNull();
    }
    for (const a of db.administrations) {
      if (a.note !== null) expect(ADMIN_NOTES).toContain(a.note);
    }
  });

  it("gives every role somebody in every service, so a demo never dead-ends", () => {
    for (const f of FACILITIES) {
      for (const s of CARE_SERVICES) {
        for (const role of CARE_ROLES) {
          expect(db.clinicians.some((c) => c.facility === f.id && c.service === s && c.role === role)).toBe(true);
        }
      }
    }
  });
});

describe("no clinical decision support", () => {
  it("holds no data that could drive an interaction or contraindication check", () => {
    // You cannot check an interaction without interaction data. The strongest
    // guarantee available is that none exists to check against.
    const allowed = ["drug", "form", "route", "doses", "frequencies", "indications", "rehabRelevant"];
    for (const f of FORMULARY) {
      expect(Object.keys(f).sort()).toEqual([...allowed].sort());
    }
    const blob = JSON.stringify(FORMULARY).toLowerCase();
    for (const term of ["interaction", "contraindicat", "maxdose", "mindose", "warning", "alert"]) {
      expect(blob).not.toContain(term);
    }
  });

  it("never computes a dose or a frequency: both are chosen from the entry", () => {
    for (const rx of db.prescriptions) {
      const entry = formularyByDrug.get(rx.drug);
      expect(entry).toBeDefined();
      expect(entry!.doses).toContain(rx.dose);
      expect(entry!.frequencies).toContain(rx.frequency);
      expect(entry!.indications).toContain(rx.indication);
      expect(rx.route).toBe(entry!.route);
      expect(rx.form).toBe(entry!.form);
    }
  });

  it("records an allergy without acting on it", () => {
    // Allergies are recorded because a human needs to read them. Nothing in
    // the code compares a prescription against them, which is the point.
    const withAllergy = db.patients.filter((p) => p.allergies.length > 0);
    expect(withAllergy.length).toBeGreaterThan(0);
    // Prescriptions exist for those patients regardless: the system does not
    // block, warn or filter on the clinical content.
    expect(withAllergy.some((p) => db.prescriptions.some((r) => r.patient === p.id))).toBe(true);
  });
});

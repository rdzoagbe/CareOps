/**
 * The access rules.
 *
 * The property that matters most is the one in the middle: declaring an
 * emergency opens the care-team gate and never the profession gate. If that
 * ever stops holding, "emergency" becomes a way for anyone to read anything,
 * which is the failure mode this design exists to prevent.
 */
import { describe, expect, it } from "vitest";
import {
  CARE_ROLES, DATA_CLASSES, PERMISSIONS, buildClinicalDataset, buildRecordView,
  canRead, canWrite, contextFor, maskName,
  type CareRole, type DataClass, type ReadContext,
} from "./repository";
import { FORMULARY, REHAB_DIAGNOSES } from "./formulary";
import { REHAB_DOC_TYPES } from "./record";

const db = buildClinicalDataset();
const classes = DATA_CLASSES.map((c) => c.key);

/** A patient with a full team: a doctor, nurses, assistants and a rehab professional. */
const patient = db.patients.find((p) => {
  const roles = p.careTeam.map((id) => db.clinicians.find((c) => c.id === id)!.role);
  return roles.includes("Physiotherapist") && roles.includes("Care assistant") && roles.includes("Nurse");
})!;

const memberWith = (role: CareRole) =>
  db.clinicians.find((c) => c.role === role && patient.careTeam.includes(c.id))!;

const outsiderWith = (role: CareRole) =>
  db.clinicians.find(
    (c) => c.role === role && c.facility === patient.facility && !patient.careTeam.includes(c.id),
  )!;

const ctxFor = (role: CareRole, onCareTeam: boolean, emergencyDeclared = false): ReadContext => ({
  role, onCareTeam, emergencyDeclared,
});

describe("the care-team gate", () => {
  it("refuses every class to someone outside the team, with a reason they can act on", () => {
    for (const role of CARE_ROLES) {
      for (const cls of classes) {
        const d = canRead(ctxFor(role, false), cls);
        expect(d.allowed).toBe(false);
        expect(d.basis).toBe("Not on the care team");
        expect(d.why).toMatch(/care team/i);
      }
    }
  });

  it("hands an outsider a view with no record in it at all", () => {
    const outsider = outsiderWith("Doctor");
    const view = buildRecordView(db, patient.id, contextFor(db, outsider.id, patient.id));
    expect(view.patient).toBeNull();
    expect(view.diagnoses).toHaveLength(0);
    expect(view.prescriptions).toHaveLength(0);
    expect(view.observations).toHaveLength(0);
    expect(view.documents).toHaveLength(0);
    expect(view.tasks).toHaveLength(0);
    expect(view.read).toHaveLength(0);
    // Redaction removes, it does not hide: the name must not be in the object
    // the screen holds, whatever the screen then chooses to render.
    expect(JSON.stringify(view)).not.toContain(patient.name);
  });

  it("shows initials instead of a name in a ward list", () => {
    expect(maskName("Renée Berger")).toBe("R. B.");
  });
});

describe("emergency access", () => {
  it("opens the care-team gate", () => {
    const d = canRead(ctxFor("Doctor", false, true), "diagnosis");
    expect(d.allowed).toBe(true);
    expect(d.basis).toBe("Emergency access");
    expect(d.why).toMatch(/recorded/i);
  });

  it("never opens the profession gate as well", () => {
    // This is the whole point. An emergency makes you a member of the team for
    // that read; it does not make you a doctor.
    for (const role of CARE_ROLES) {
      for (const cls of classes) {
        const emergency = canRead(ctxFor(role, false, true), cls);
        const member = canRead(ctxFor(role, true), cls);
        expect(emergency.allowed).toBe(member.allowed);
        expect(emergency.grant).toBe(member.grant);
      }
    }
  });

  it("gives a care assistant in an emergency no more of the record than one on the team", () => {
    const assistant = outsiderWith("Care assistant");
    const view = buildRecordView(db, patient.id, {
      ...contextFor(db, assistant.id, patient.id),
      emergencyDeclared: true,
    });
    expect(view.patient).not.toBeNull();
    expect(view.diagnoses).toHaveLength(0);
    expect(view.prescriptions).toHaveLength(0);
  });
});

describe("the profession gate", () => {
  it("keeps diagnoses and medication away from a care assistant", () => {
    const view = buildRecordView(db, patient.id, contextFor(db, memberWith("Care assistant").id, patient.id));
    expect(view.patient).not.toBeNull();
    expect(view.tasks.length).toBeGreaterThan(0);
    expect(view.diagnoses).toHaveLength(0);
    expect(view.prescriptions).toHaveLength(0);
    expect(view.administrations).toHaveLength(0);
    expect(view.documents).toHaveLength(0);
    expect(view.decisions.diagnosis.why).toMatch(/do not have access/i);
  });

  it("gives a physiotherapist only what bears on a session", () => {
    const view = buildRecordView(db, patient.id, contextFor(db, memberWith("Physiotherapist").id, patient.id));
    const rehabDrugs = new Set(FORMULARY.filter((f) => f.rehabRelevant).map((f) => f.drug));

    expect(view.decisions.medication.grant).toBe("limited");
    expect(view.decisions.medication.limitedReason).toBeTruthy();
    for (const p of view.prescriptions) {
      expect(rehabDrugs.has(p.drug)).toBe(true);
      expect(p.status).toBe("Active");
    }
    // The administration record is a nursing document, not a rehab one.
    expect(view.administrations).toHaveLength(0);
    for (const d of view.diagnoses) expect(d.kind).toBe("Main");
    for (const doc of view.documents) expect(REHAB_DOC_TYPES).toContain(doc.type);
  });

  it("gives the doctor the whole record", () => {
    const view = buildRecordView(db, patient.id, contextFor(db, memberWith("Doctor").id, patient.id));
    expect(view.diagnoses.length).toBe(db.diagnoses.filter((d) => d.patient === patient.id).length);
    expect(view.prescriptions.length).toBe(db.prescriptions.filter((p) => p.patient === patient.id).length);
    expect(view.documents.length).toBe(db.documents.filter((d) => d.patient === patient.id).length);
    expect(view.read).toEqual(classes);
  });

  it("lets nobody write what they may not read", () => {
    for (const role of CARE_ROLES) {
      for (const cls of classes) {
        if (canWrite(ctxFor(role, true), cls)) expect(canRead(ctxFor(role, true), cls).allowed).toBe(true);
        expect(canWrite(ctxFor(role, false), cls)).toBe(false);
      }
    }
  });
});

describe("the matrix itself", () => {
  it("lets every profession identify the patient in front of them", () => {
    for (const role of CARE_ROLES) expect(PERMISSIONS[role].identity).not.toBe("none");
  });

  it("gives every class a reader, and every class but identity a writer", () => {
    for (const cls of classes) {
      const grants = CARE_ROLES.map((r) => PERMISSIONS[r][cls]);
      expect(grants.some((g) => g !== "none")).toBe(true);
      // Identity is deliberately read-only for every profession: it is created
      // at admission, and a ward is not where a patient's identity is edited.
      if (cls === "identity") expect(grants).not.toContain("write");
      else expect(grants).toContain("write");
    }
  });

  it("closes part of the record to every profession whose scope is narrower", () => {
    // Doctors and nurses read the whole record of a patient they are caring
    // for, which is how a ward works. The professions with a narrower scope
    // must each have something closed to them, or the matrix is decorative.
    for (const role of ["Care assistant", "Physiotherapist", "Osteopath"] as CareRole[]) {
      expect(classes.some((c) => PERMISSIONS[role][c] === "none")).toBe(true);
    }
  });

  it("lets only a doctor prescribe or record a diagnosis", () => {
    for (const role of CARE_ROLES) {
      const mayPrescribe = PERMISSIONS[role].medication === "write";
      const mayDiagnose = PERMISSIONS[role].diagnosis === "write";
      expect(mayPrescribe).toBe(role === "Doctor");
      expect(mayDiagnose).toBe(role === "Doctor");
    }
  });

  it("states the limit wherever a grant is partial", () => {
    for (const role of CARE_ROLES) {
      for (const cls of classes as DataClass[]) {
        if (PERMISSIONS[role][cls] !== "limited") continue;
        expect(canRead(ctxFor(role, true), cls).limitedReason).toBeTruthy();
      }
    }
  });

  it("does not let a rehabilitation professional reach a diagnosis outside their referral", () => {
    for (const role of ["Physiotherapist", "Osteopath"] as CareRole[]) {
      expect(PERMISSIONS[role].diagnosis).toBe("limited");
    }
    expect(REHAB_DIAGNOSES.length).toBeGreaterThan(0);
  });
});

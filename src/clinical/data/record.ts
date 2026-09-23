/**
 * The redaction layer.
 *
 * Screens do not receive a patient and then decide what to hide. They receive
 * a view that was assembled under an access decision, so what a reader may not
 * see is never in the object the screen holds — and therefore never in the
 * page for anyone who opens the developer tools.
 *
 * Every call also produces the entries that belong in the patient's own
 * file-access list. Logging is not a side effect a screen may forget: it comes
 * back with the data.
 */
import { canRead, type AccessDecision, type ReadContext } from "./access";
import { FORMULARY } from "./formulary";
import type {
  Administration, CarePlanTask, ClinicalDataset, ClinicalDocument, DataClass,
  Diagnosis, FileAccess, Observation, Patient, Prescription,
} from "./types";

/** Documents a rehabilitation professional's referral can rest on. */
export const REHAB_DOC_TYPES = ["Rehabilitation referral", "Operating note", "Imaging report"];

const rehabRelevantDrugs = new Set(FORMULARY.filter((f) => f.rehabRelevant).map((f) => f.drug));

export interface PatientRecordView {
  patient: Patient | null;
  decisions: Record<DataClass, AccessDecision>;
  diagnoses: Diagnosis[];
  prescriptions: Prescription[];
  administrations: Administration[];
  tasks: CarePlanTask[];
  observations: Observation[];
  documents: ClinicalDocument[];
  /** The classes actually read, for the entry written to the access list. */
  read: DataClass[];
}

/** Initials, for a patient whose record this reader may not open. */
export const maskName = (name: string): string =>
  name.split(" ").map((p) => (p[0] ?? "").toUpperCase() + ".").join(" ");

export function contextFor(
  db: ClinicalDataset,
  clinicianId: string,
  patientId: string,
  emergencyDeclared = false,
): ReadContext {
  const pro = db.clinicians.find((c) => c.id === clinicianId)!;
  const patient = db.patients.find((p) => p.id === patientId);
  return {
    role: pro.role,
    onCareTeam: !!patient && patient.careTeam.includes(clinicianId),
    emergencyDeclared,
  };
}

export function buildRecordView(
  db: ClinicalDataset,
  patientId: string,
  ctx: ReadContext,
): PatientRecordView {
  const classes: DataClass[] =
    ["identity", "careplan", "vitals", "medication", "diagnosis", "rehab", "documents", "notes"];
  const decisions = Object.fromEntries(
    classes.map((c) => [c, canRead(ctx, c)]),
  ) as Record<DataClass, AccessDecision>;

  const patient = db.patients.find((p) => p.id === patientId) ?? null;
  const allowed = (c: DataClass) => decisions[c].allowed;
  const grant = (c: DataClass) => decisions[c].grant;

  const forPatient = <T extends { patient: string }>(xs: T[]) => xs.filter((x) => x.patient === patientId);

  /* diagnoses: `limited` keeps only what a referral can rest on */
  let diagnoses: Diagnosis[] = [];
  if (allowed("diagnosis")) {
    diagnoses = forPatient(db.diagnoses);
    if (grant("diagnosis") === "limited") diagnoses = diagnoses.filter((d) => d.kind === "Main");
  }

  /* medication: `limited` keeps only what bears on a rehabilitation session */
  let prescriptions: Prescription[] = [];
  let administrations: Administration[] = [];
  if (allowed("medication")) {
    prescriptions = forPatient(db.prescriptions);
    if (grant("medication") === "limited") {
      prescriptions = prescriptions.filter((p) => p.status === "Active" && rehabRelevantDrugs.has(p.drug));
      // The administration record is a nursing document. A limited reader sees
      // what is prescribed, not who gave what and when.
      administrations = [];
    } else {
      administrations = forPatient(db.administrations);
    }
  }

  const tasks: CarePlanTask[] = allowed("careplan") ? forPatient(db.tasks) : [];

  /* observations split across two classes: vitals, and written notes */
  const obsAll = forPatient(db.observations);
  const observations: Observation[] = [
    ...(allowed("vitals") ? obsAll.filter((o) => o.kind === "Vitals") : []),
    ...(allowed("notes") ? obsAll.filter((o) => o.kind === "Note") : []),
    ...(allowed("rehab") ? obsAll.filter((o) => o.kind === "Rehab") : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  let documents: ClinicalDocument[] = [];
  if (allowed("documents")) {
    documents = forPatient(db.documents);
    if (grant("documents") === "limited") documents = documents.filter((d) => REHAB_DOC_TYPES.includes(d.type));
  }

  const read = classes.filter((c) => decisions[c].allowed);

  return {
    patient: allowed("identity") ? patient : null,
    decisions,
    diagnoses,
    prescriptions,
    administrations,
    tasks,
    observations,
    documents,
    read,
  };
}

/** The entry a read owes the patient's file-access list. */
export function accessEntry(
  view: PatientRecordView,
  patientId: string,
  clinician: { id: string; role: FileAccess["role"] },
  ctx: ReadContext,
  reason: string,
  now: string,
  sequence: number,
): FileAccess | null {
  if (view.read.length === 0) return null;
  return {
    id: "ACC-L" + String(sequence).padStart(5, "0"),
    patient: patientId,
    at: now,
    who: clinician.id,
    role: clinician.role,
    classes: view.read,
    basis: ctx.onCareTeam ? "Care team" : "Emergency access",
    reason,
  };
}

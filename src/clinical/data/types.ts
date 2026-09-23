/**
 * Domain types for the care side of CareOps.
 *
 * Everything here is a FICTIONAL patient. The rule on the back-office side is
 * "no patient data anywhere"; that rule is unchanged and still enforced on
 * `src/data`. This is a separate world with its own repository, its own
 * generator and its own access rules, and nothing imports across the two.
 *
 * Read `access.ts` before adding a field. A field that no role may read is a
 * field that should not exist, and a field readable by everyone is almost
 * always a mistake.
 */

/** The professions the care console knows about. */
export type CareRole =
  | "Doctor"
  | "Nurse"
  | "Care assistant"
  | "Physiotherapist"
  | "Osteopath";

/**
 * A record is divided into classes, and permission is granted per class rather
 * than per screen. A screen cannot leak what the class rules do not allow,
 * because the screen asks for a class before it renders anything.
 */
export type DataClass =
  | "identity"
  | "careplan"
  | "vitals"
  | "medication"
  | "diagnosis"
  | "rehab"
  | "documents"
  | "notes";

export interface Clinician {
  id: string;
  name: string;
  role: CareRole;
  facility: string;
  service: string;
  /** Fictional stand-in for a professional registration number. */
  registration: string;
}

export interface Patient {
  id: string;
  /**
   * Stand-in for a national health identifier. Deliberately shaped so it can
   * never be mistaken for a real one: see `DEMO_INS_PREFIX`.
   */
  ins: string;
  name: string;
  born: string;
  sex: "F" | "M";
  facility: string;
  service: string;
  room: string;
  admitted: string;
  expectedDischarge: string | null;
  status: "Inpatient" | "Day case" | "Outpatient" | "Discharged";
  /** Admission reason, from a fixed list. Never free text. */
  reason: string;
  /** The care team. Nobody outside it reads this record without declaring why. */
  careTeam: string[];
  referrer: string;
  allergies: string[];
  autonomy: "Independent" | "Needs help" | "Fully dependent";
  mobility: string;
  consent: {
    /** Sharing the record with the treating team outside this facility. */
    share: boolean;
    /** Being contacted about research. Off unless the patient said yes. */
    research: boolean;
    /** A relative the patient named as the person to inform. */
    trustedPerson: string | null;
  };
}

export interface Diagnosis {
  id: string;
  patient: string;
  label: string;
  since: string;
  by: string;
  kind: "Main" | "Associated" | "History";
}

export interface Prescription {
  id: string;
  patient: string;
  drug: string;
  form: string;
  dose: string;
  route: string;
  frequency: string;
  started: string;
  ends: string | null;
  /** Always a doctor. The type does not stop it; `access.ts` does. */
  prescriber: string;
  status: "Active" | "Stopped" | "Completed";
  indication: string;
}

export interface Administration {
  id: string;
  prescription: string;
  patient: string;
  at: string;
  by: string;
  status: "Given" | "Refused by patient" | "Not given";
  /** From a fixed list. There is no free-text box on this record. */
  note: string | null;
}

export interface CarePlanTask {
  id: string;
  patient: string;
  kind: string;
  title: string;
  due: string;
  frequency: string;
  role: CareRole;
  done: boolean;
  by: string | null;
}

export interface Observation {
  id: string;
  patient: string;
  at: string;
  by: string;
  role: CareRole;
  kind: "Vitals" | "Note" | "Rehab";
  temperature: number | null;
  pulse: number | null;
  systolic: number | null;
  diastolic: number | null;
  /** Self-reported pain, 0 to 10. The patient's own words, as a number. */
  pain: number | null;
  text: string | null;
}

export interface ClinicalDocument {
  id: string;
  patient: string;
  type: string;
  date: string;
  author: string;
  summary: string;
}

/**
 * Every read of a record, kept for the patient rather than for the employer.
 * The patient app shows this list in full — the same rule the staff side
 * already has for personnel files.
 */
export interface FileAccess {
  id: string;
  patient: string;
  at: string;
  who: string;
  role: CareRole;
  classes: DataClass[];
  /** Why the reader was entitled to it. */
  basis: "Care team" | "Emergency access";
  reason: string;
}

export interface ClinicalDataset {
  clinicians: Clinician[];
  patients: Patient[];
  diagnoses: Diagnosis[];
  prescriptions: Prescription[];
  administrations: Administration[];
  tasks: CarePlanTask[];
  observations: Observation[];
  documents: ClinicalDocument[];
  access: FileAccess[];
}

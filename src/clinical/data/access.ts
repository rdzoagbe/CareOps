/**
 * Who may read what, and on what basis.
 *
 * Two independent gates, and a read needs both:
 *
 *   1. **Is this reader on the patient's care team?** Nobody outside it reads a
 *      record at all. A reader may declare an emergency and go in anyway, and
 *      that declaration is recorded, shown to the patient, and never silent.
 *   2. **Does this reader's profession cover that class of data?** Least
 *      privilege by scope of practice: a care assistant does not read
 *      diagnoses, a physiotherapist does not read the whole medication list.
 *
 * The gates are deliberately separate, because the emergency gate opens the
 * first one and *never* the second: declaring an emergency makes you a member
 * of the care team for that read, it does not make you a doctor. That is the
 * property `canRead` enforces and `access.test.ts` proves.
 *
 * ---
 *
 * The matrix below is a STARTING CONFIGURATION for a demo, not a legal
 * standard. Each establishment has to validate it against each profession's
 * actual scope of practice and against its own patient-rights policy, with its
 * DPO and its medical board. It is written as data, in one place, so that a
 * validated matrix can replace it without touching a screen.
 */
import type { CareRole, DataClass } from "./types";

export const CARE_ROLES: CareRole[] = [
  "Doctor",
  "Nurse",
  "Care assistant",
  "Physiotherapist",
  "Osteopath",
];

/**
 * - `none`    the class does not exist for this reader; screens do not render it
 * - `limited` only what concerns this reader's own intervention, with the
 *             restriction stated on screen rather than hidden
 * - `read`    the whole class, read only
 * - `write`   read, and may add to it
 */
export type Grant = "none" | "limited" | "read" | "write";

export const DATA_CLASSES: { key: DataClass; label: string; what: string }[] = [
  { key: "identity", label: "Identity and stay", what: "Name, date of birth, ward, room, dates, the person to inform" },
  { key: "careplan", label: "Care plan", what: "The day's care: hygiene, mobility, nutrition, positioning" },
  { key: "vitals", label: "Observations and vitals", what: "Temperature, pulse, blood pressure, reported pain" },
  { key: "medication", label: "Medication", what: "Prescriptions in force and the administration record" },
  { key: "diagnosis", label: "Diagnoses", what: "Medical diagnoses and history" },
  { key: "rehab", label: "Rehabilitation", what: "Mobility assessment, referrals, session notes" },
  { key: "documents", label: "Documents", what: "Reports, letters, results" },
  { key: "notes", label: "Notes", what: "Written observations by the care team" },
];

export const PERMISSIONS: Record<CareRole, Record<DataClass, Grant>> = {
  Doctor: {
    identity: "read", careplan: "read", vitals: "read", medication: "write",
    diagnosis: "write", rehab: "read", documents: "write", notes: "write",
  },
  Nurse: {
    identity: "read", careplan: "write", vitals: "write", medication: "read",
    diagnosis: "read", rehab: "read", documents: "read", notes: "write",
  },
  "Care assistant": {
    identity: "read", careplan: "write", vitals: "write", medication: "none",
    diagnosis: "none", rehab: "read", documents: "none", notes: "write",
  },
  // Rehabilitation professionals document in `rehab`, which is their own
  // stream. The nursing note stream is nursing documentation and is not theirs
  // to read or add to, so it is closed rather than shared.
  Physiotherapist: {
    identity: "read", careplan: "read", vitals: "read", medication: "limited",
    diagnosis: "limited", rehab: "write", documents: "limited", notes: "none",
  },
  Osteopath: {
    identity: "read", careplan: "none", vitals: "read", medication: "limited",
    diagnosis: "limited", rehab: "write", documents: "limited", notes: "none",
  },
};

/** Said on screen wherever a class comes back `limited`, so the limit is visible. */
export const LIMITED_REASON: Partial<Record<CareRole, Partial<Record<DataClass, string>>>> = {
  Physiotherapist: {
    medication: "Only what bears on mobility and on what is safe to do in a session.",
    diagnosis: "Only the diagnoses the referral rests on.",
    documents: "Only documents attached to the rehabilitation referral.",
  },
  Osteopath: {
    medication: "Only what bears on what is safe to do in a session.",
    diagnosis: "Only the diagnoses the referral rests on.",
    documents: "Only documents attached to the referral.",
  },
};

export type AccessBasis = "Care team" | "Emergency access" | "Not on the care team";

export interface AccessDecision {
  allowed: boolean;
  grant: Grant;
  basis: AccessBasis;
  /** Written for the person refused, not for a log file. */
  why: string;
  limitedReason?: string;
}

export interface ReadContext {
  role: CareRole;
  /** Whether this reader is on the patient's care team. */
  onCareTeam: boolean;
  /** An emergency the reader has declared and signed for on this record. */
  emergencyDeclared?: boolean;
}

/**
 * The single decision point. Screens call this and render nothing a `false`
 * comes back for — they do not fetch and then hide, because hiding is how data
 * ends up in the page for anyone who opens the developer tools.
 */
export function canRead(ctx: ReadContext, cls: DataClass): AccessDecision {
  const grant = PERMISSIONS[ctx.role][cls];

  if (!ctx.onCareTeam && !ctx.emergencyDeclared) {
    return {
      allowed: false,
      grant: "none",
      basis: "Not on the care team",
      why: "You are not in this patient's care team. Ask to be added, or declare an emergency, which is recorded and shown to the patient.",
    };
  }

  const basis: AccessBasis = ctx.onCareTeam ? "Care team" : "Emergency access";

  if (grant === "none") {
    return {
      allowed: false,
      grant,
      basis,
      why: `${ctx.role}s do not have access to this part of the record in this establishment's configuration.`,
    };
  }

  return {
    allowed: true,
    grant,
    basis,
    why: basis === "Emergency access"
      ? "Emergency access. This read is recorded and appears in the patient's own file-access list."
      : "You are in this patient's care team.",
    limitedReason: grant === "limited" ? LIMITED_REASON[ctx.role]?.[cls] : undefined,
  };
}

export const canWrite = (ctx: ReadContext, cls: DataClass): boolean =>
  canRead(ctx, cls).allowed && PERMISSIONS[ctx.role][cls] === "write";

/** The classes a role may see at all, for the "what my profession sees" screen. */
export const classesFor = (role: CareRole): DataClass[] =>
  DATA_CLASSES.map((c) => c.key).filter((k) => PERMISSIONS[role][k] !== "none");

/**
 * Reasons a reader may give for an emergency access. Chosen from a list, never
 * typed: a free-text box produces "urgent" and proves nothing afterwards.
 */
export const EMERGENCY_REASONS = [
  "Patient in my care right now and I am not yet on the team",
  "Covering a colleague who is unavailable",
  "Clinical handover in progress",
  "Vital emergency, no time to request access",
];

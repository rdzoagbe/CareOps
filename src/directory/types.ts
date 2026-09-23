/**
 * The directory: one entry per human being, across all three platforms.
 *
 * This layer exists because the same person is three records elsewhere. A
 * nurse is an employee in the back office, a clinician on the care side, and a
 * phone user in the staff app. Without a directory, nothing connects them —
 * and the consequences are practical, not theoretical: suspend someone in HR
 * and their access to patient records would carry on untouched.
 *
 * What the directory holds is deliberately thin. Who someone is, where they
 * work, what kind of contract they are on, and what they have been granted.
 * **No pay, no patient data, no personnel file.** It is the join, not a third
 * copy of everything, and `directory.test.ts` asserts that a directory entry
 * carries neither a salary nor anything clinical.
 */

/** The three platforms, and who each one is for. */
export type Platform = "admin" | "care" | "app";

export const PLATFORMS: { key: Platform; label: string; who: string; route: string }[] = [
  {
    key: "admin",
    label: "Administration",
    who: "The staff who run the group: HR, payroll, finance, procurement, compliance, direction.",
    route: "/portal",
  },
  {
    key: "care",
    label: "Care",
    who: "The staff who treat patients: doctors, nurses, care assistants, physiotherapists, osteopaths.",
    route: "/care",
  },
  {
    key: "app",
    label: "Staff app",
    who: "Every member of staff on their phone, including the people who come in for extra shifts.",
    route: "/app",
  },
];

export interface RoleDef {
  key: string;
  label: string;
  platform: Platform;
  /** One line: what this role is for. */
  what: string;
  /** What it opens. */
  sees: string[];
  /** What it does not open, however senior the holder is. The important column. */
  cannot: string[];
  /**
   * A role that may be held by someone with no employment contract — an
   * external practitioner, for instance. Such a grant always has an end date.
   */
  external?: boolean;
}

export type EmploymentKind =
  | "Permanent"
  | "Fixed term"
  | "Agency"
  | "Bank"
  | "Apprentice"
  | "External";

export type PersonStatus = "Active" | "On leave" | "Suspended" | "Left";

export interface RoleGrant {
  role: string;
  facility: string;
  service: string | null;
  from: string;
  /** Mandatory for anyone not permanent: access ends when the assignment does. */
  until: string | null;
  grantedBy: string;
}

export interface Person {
  id: string;
  name: string;
  facility: string;
  service: string;
  employment: EmploymentKind;
  status: PersonStatus;
  grants: RoleGrant[];
  /** Ids only. The directory never reads what is behind them. */
  employeeRef: string | null;
  clinicianRef: string | null;
}

export interface Directory {
  people: Person[];
}

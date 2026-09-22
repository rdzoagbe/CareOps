/**
 * Builds the directory from what the two sides already know.
 *
 * It takes narrow records rather than the real `Employee` and `Clinician`
 * types, deliberately: a `StaffRecord` has no salary field to read and a
 * `CareRecord` has no patient in it. The mapping is done by the caller, which
 * is the only place that sees both, and the directory itself imports nothing
 * from either side.
 *
 * The interesting output is the person who appears twice. A nurse linked to an
 * employee record is one entry with three grants — care, staff app, and
 * whatever administration they hold — and suspending that one entry stops all
 * three at once.
 */
import { iso, dayAdd } from "@/data/dates";
import type { Directory, EmploymentKind, Person, PersonStatus, RoleGrant } from "./types";
import { needsEndDate } from "./roles";

/** What the back office contributes. No pay, by construction. */
export interface StaffRecord {
  id: string;
  name: string;
  facility: string;
  dept: string;
  /** CDI, CDD, Agency, Apprentice. */
  contract: string;
  /** Active or On leave. */
  status: string;
  /** The job title, used to work out which administrative role fits. */
  role: string;
}

/** What the care side contributes. No patient, by construction. */
export interface CareRecord {
  id: string;
  name: string;
  facility: string;
  service: string;
  /** Doctor, Nurse, Care assistant, Physiotherapist, Osteopath. */
  role: string;
}

class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed; }
  next(): number { this.s = (this.s * 1664525 + 1013904223) % 4294967296; return this.s / 4294967296; }
  int(a: number, b: number): number { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p: number): boolean { return this.next() < p; }
}

export const DIRECTORY_SEED = 550231;

const CARE_ROLE_KEY: Record<string, string> = {
  Doctor: "doctor",
  Nurse: "nurse",
  "Care assistant": "care-assistant",
  Physiotherapist: "physiotherapist",
  Osteopath: "osteopath",
};

/** The job titles on each side that plausibly describe the same person. */
const TITLE_MATCH: Record<string, RegExp> = {
  Doctor: /physician|surgeon|intensivist|obstetrician|radiologist|anaesthetist/i,
  Nurse: /nurse|midwife/i,
  "Care assistant": /care assistant|assistant/i,
  Physiotherapist: /therapist|radiographer/i,
  Osteopath: /^$/, // never matches: osteopaths in this demo are external practitioners
};

const ADMIN_ROLE_FOR = (dept: string, title: string): string | null => {
  if (/payroll/i.test(title)) return "payroll";
  if (/data protection/i.test(title)) return "compliance";
  if (dept === "HR") return "hr";
  if (dept === "Finance") return "finance";
  if (dept === "Procurement") return "buyer";
  return null;
};

const contractToEmployment = (contract: string, bank: boolean): EmploymentKind =>
  bank ? "Bank"
  : contract === "CDI" ? "Permanent"
  : contract === "CDD" ? "Fixed term"
  : contract === "Agency" ? "Agency"
  : "Apprentice";

const pad = (n: number) => String(n).padStart(4, "0");

export function buildDirectory(
  staff: StaffRecord[],
  care: CareRecord[],
  seed: number = DIRECTORY_SEED,
): Directory {
  const rng = new Rng(seed);
  const people: Person[] = [];
  const takenStaff = new Set<string>();

  const grant = (
    role: string,
    facility: string,
    service: string | null,
    employment: EmploymentKind,
    grantedBy: string,
  ): RoleGrant => ({
    role,
    facility,
    service,
    from: iso(dayAdd(-rng.int(40, 900))),
    until: needsEndDate(employment) ? iso(dayAdd(rng.int(-20, 300))) : null,
    grantedBy,
  });

  const ADMIN = "PSN-0001";

  /* ---- the access administrator comes first, so they can grant the rest ---- */
  const itPerson = staff.find((s) => s.dept === "IT" && /system administrator/i.test(s.role));
  people.push({
    id: ADMIN,
    name: itPerson?.name ?? "A. Karim",
    facility: itPerson?.facility ?? care[0].facility,
    service: "IT",
    employment: "Permanent",
    status: "Active",
    grants: [
      { role: "access-admin", facility: "ALL", service: null, from: iso(dayAdd(-1200)), until: null, grantedBy: "Direction" },
      { role: "staff", facility: itPerson?.facility ?? care[0].facility, service: "IT", from: iso(dayAdd(-1200)), until: null, grantedBy: "Direction" },
    ],
    employeeRef: itPerson?.id ?? null,
    clinicianRef: null,
  });
  if (itPerson) takenStaff.add(itPerson.id);

  /* ---- clinicians, linked to an employee record where one plausibly matches ---- */
  for (const c of care) {
    const pattern = TITLE_MATCH[c.role];
    const match = pattern
      ? staff.find(
          (s) =>
            !takenStaff.has(s.id) &&
            s.facility === c.facility &&
            s.dept === c.service &&
            pattern.test(s.role),
        )
      : undefined;
    if (match) takenStaff.add(match.id);

    // An unmatched clinician is an external practitioner: they treat patients
    // here without an employment contract with the group.
    const employment: EmploymentKind = match
      ? contractToEmployment(match.contract, false)
      : "External";

    // A handful are suspended or have left, so the revocation rule has
    // something to act on in the demo.
    const status: PersonStatus =
      match?.status === "On leave" ? "On leave"
      : rng.chance(0.012) ? "Suspended"
      : rng.chance(0.012) ? "Left"
      : "Active";

    const grants: RoleGrant[] = [
      grant(CARE_ROLE_KEY[c.role] ?? "nurse", c.facility, c.service, employment, ADMIN),
    ];
    // Only someone employed here gets the staff app.
    if (match) {
      grants.push(grant("staff", c.facility, c.service, employment, ADMIN));
      const admin = ADMIN_ROLE_FOR(match.dept, match.role);
      if (admin) grants.push(grant(admin, c.facility, null, employment, ADMIN));
    }

    people.push({
      id: "PSN-" + pad(people.length + 1),
      name: c.name,
      facility: c.facility,
      service: c.service,
      employment,
      status,
      grants,
      employeeRef: match?.id ?? null,
      clinicianRef: c.id,
    });
  }

  /* ---- everyone else: back office and the staff app ---- */
  let director = false;
  for (const s of staff) {
    if (takenStaff.has(s.id)) continue;

    // Roughly one agency worker in three is here for extra shifts rather than
    // a posting: the "extra time" case, which the app treats differently.
    const bank = s.contract === "Agency" && rng.chance(0.34);
    const employment = contractToEmployment(s.contract, bank);
    const status: PersonStatus =
      s.status === "On leave" ? "On leave" : rng.chance(0.004) ? "Left" : "Active";

    const grants: RoleGrant[] = [
      grant(bank ? "bank" : "staff", s.facility, s.dept, employment, ADMIN),
    ];

    const adminRole = ADMIN_ROLE_FOR(s.dept, s.role);
    if (adminRole) grants.push(grant(adminRole, s.facility, null, employment, ADMIN));

    // One group operations director, and one manager per service.
    if (!director && s.dept === "Finance" && /controller/i.test(s.role)) {
      grants.push({ role: "ops-director", facility: "ALL", service: null, from: iso(dayAdd(-800)), until: null, grantedBy: "Direction" });
      director = true;
    } else if (/supervisor|coordinator|business partner/i.test(s.role)) {
      grants.push(grant("service-manager", s.facility, s.dept, employment, ADMIN));
    }

    people.push({
      id: "PSN-" + pad(people.length + 1),
      name: s.name,
      facility: s.facility,
      service: s.dept,
      employment,
      status,
      grants,
      employeeRef: s.id,
      clinicianRef: null,
    });
  }

  return { people };
}

/** Narrow a back-office employee down to what the directory is allowed to see. */
export const staffRecord = (e: {
  id: string; name: string; facility: string; dept: string;
  contract: string; status: string; role: string;
}): StaffRecord => ({
  id: e.id, name: e.name, facility: e.facility, dept: e.dept,
  contract: e.contract, status: e.status, role: e.role,
});

/** Narrow a clinician down to what the directory is allowed to see. */
export const careRecord = (c: {
  id: string; name: string; facility: string; service: string; role: string;
}): CareRecord => ({
  id: c.id, name: c.name, facility: c.facility, service: c.service, role: c.role,
});

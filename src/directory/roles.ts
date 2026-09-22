/**
 * Every role in the group, on all three platforms, with what it opens and what
 * it does not.
 *
 * Four rules govern the whole thing, and each is enforced by a function here
 * rather than by a convention:
 *
 * 1. **A role on one platform grants nothing on another.** Being head of HR
 *    does not open a patient record. Being a doctor does not open a payslip.
 *    There is no seniority that crosses the line, because the line is not
 *    about seniority.
 *
 * 2. **Whoever administers access never reads content.** The access
 *    administrator grants and revokes roles and can see who holds what. They
 *    cannot open a patient record, a personnel file or a pay figure. Separating
 *    the two is the point: the person who can give themselves a permission must
 *    not be the person that permission is worth having for.
 *
 * 3. **Access that is not permanent has an end date.** Agency, bank and
 *    external grants expire with the assignment instead of lingering after it.
 *
 * 4. **Leaving or being suspended revokes everything at once**, on all three
 *    platforms, because there is one directory entry rather than three.
 *
 * And one safeguard that is not a rule about privacy but about not locking
 * everybody out: nobody may change their own access, and the last access
 * administrator cannot be removed. Without it, one click ends the ability to
 * grant anything ever again — including the ability to undo that click.
 */
import type { EmploymentKind, Person, Platform, RoleDef, RoleGrant } from "./types";

export const ROLES: RoleDef[] = [
  /* ---------------- administration ---------------- */
  {
    key: "ops-director",
    label: "Group operations director",
    platform: "admin",
    what: "Runs the back office across the four sites.",
    sees: ["Every back-office module", "All facilities", "The audit journal"],
    cannot: ["Open a patient record", "Read a clinical note", "See a diagnosis"],
  },
  {
    key: "hr",
    label: "HR officer",
    platform: "admin",
    what: "Personnel files, contracts, renewals, onboarding.",
    sees: ["Personnel files", "Contracts and renewals", "Absences by type"],
    cannot: [
      "Open a patient record",
      "See a medical reason for an absence",
      "Approve spend or a purchase order",
    ],
  },
  {
    key: "payroll",
    label: "Payroll administrator",
    platform: "admin",
    what: "Pay variables, and the validation a person has to give them.",
    sees: ["Pay variables", "Hours and absences by type"],
    cannot: ["Open a patient record", "Change a contract", "See a medical reason"],
  },
  {
    key: "finance",
    label: "Management controller",
    platform: "admin",
    what: "Budgets, invoices, the three-way match.",
    sees: ["Budgets and actuals", "Invoices and exceptions", "Supplier spend"],
    cannot: ["Open a patient record", "Open a personnel file", "See an individual salary"],
  },
  {
    key: "buyer",
    label: "Procurement officer",
    platform: "admin",
    what: "Suppliers, purchase orders, and the over-ordering alerts.",
    sees: ["Suppliers and contracts", "The order ledger", "Ordering alerts"],
    cannot: [
      "Open a patient record",
      "Open a personnel file",
      "See who placed an order, inside an alert",
    ],
  },
  {
    key: "compliance",
    label: "Compliance officer",
    platform: "admin",
    what: "Controls, findings, audits and the access journal. Reads, does not change.",
    sees: ["Controls and findings", "The audit journal", "Who opened which file"],
    cannot: ["Open a patient record", "Change any record", "Grant a role"],
  },
  {
    key: "service-manager",
    label: "Service manager",
    platform: "admin",
    what: "Runs one service: its rota, its absences, its budget line.",
    sees: ["Their own service only", "Rota and coverage", "Absences by type"],
    cannot: [
      "See another service",
      "Open a patient record without a care role of their own",
      "See a medical reason",
    ],
  },

  /* ---------------- care ---------------- */
  {
    key: "doctor",
    label: "Doctor",
    platform: "care",
    what: "Diagnoses, prescribes, and reads the whole record of their patients.",
    sees: ["The full record of patients in their care team"],
    cannot: ["Open a record outside their care team without declaring an emergency", "See pay or contracts"],
  },
  {
    key: "nurse",
    label: "Nurse",
    platform: "care",
    what: "Care plan, observations, and administering what was prescribed.",
    sees: ["The record of patients in their care team", "The medication to administer"],
    cannot: ["Prescribe", "Record a diagnosis", "See pay or contracts"],
  },
  {
    key: "care-assistant",
    label: "Care assistant",
    platform: "care",
    what: "Daily care: hygiene, mobility, nutrition, positioning.",
    sees: ["Identity and stay", "The care plan", "Observations they record"],
    cannot: ["See diagnoses", "See medication", "See documents", "See pay or contracts"],
  },
  {
    key: "physiotherapist",
    label: "Physiotherapist",
    platform: "care",
    what: "Rehabilitation: assessment, sessions, progress.",
    sees: [
      "Identity and stay",
      "Only the prescriptions bearing on a session",
      "Only the diagnoses the referral rests on",
    ],
    cannot: ["See the whole medication list", "Read the nursing note stream", "See pay or contracts"],
    external: true,
  },
  {
    key: "osteopath",
    label: "Osteopath",
    platform: "care",
    what: "Sessions on referral.",
    sees: ["Identity and stay", "Only what the referral rests on"],
    cannot: [
      "See the care plan",
      "See the whole medication list",
      "Read the nursing note stream",
      "See pay or contracts",
    ],
    external: true,
  },

  /* ---------------- staff app ---------------- */
  {
    key: "staff",
    label: "Member of staff",
    platform: "app",
    what: "Their own working life on their phone.",
    sees: ["Their own rota", "Their own absences and balances", "Their own contract and documents"],
    cannot: ["See a colleague's file", "See any patient data", "See any budget"],
  },
  {
    key: "bank",
    label: "Extra shifts",
    platform: "app",
    what:
      "For the people who come in for extra time: open shifts, the hours they worked, their own " +
      "documents. No fixed rota, because there is no fixed post.",
    sees: ["Open shifts they may take", "The hours they worked", "Their own documents"],
    cannot: [
      "See the full service rota",
      "See any patient data without a care role of their own",
      "See any colleague's file",
    ],
    external: true,
  },

  /* ---------------- across all three ---------------- */
  {
    key: "access-admin",
    label: "Access administrator",
    platform: "admin",
    what: "Grants and revokes roles, and can answer who has access to what.",
    sees: ["Every person and every grant", "When a grant expires", "The record of who granted what"],
    cannot: [
      "Open a patient record",
      "Open a personnel file",
      "See any pay figure",
      "Grant themselves a role on another platform",
    ],
  },
];

export const roleByKey = (key: string): RoleDef | undefined => ROLES.find((r) => r.key === key);

export const rolesOn = (platform: Platform): RoleDef[] => ROLES.filter((r) => r.platform === platform);

/** Employment kinds whose access must carry an end date. */
export const TEMPORARY: EmploymentKind[] = ["Fixed term", "Agency", "Bank", "External", "Apprentice"];

export const needsEndDate = (employment: EmploymentKind): boolean => TEMPORARY.includes(employment);

/**
 * The grants that count today. A grant is live only while its holder is, which
 * is rule 4: one entry, one status, every platform at once.
 */
export function liveGrants(person: Person, today: string): RoleGrant[] {
  if (person.status === "Left" || person.status === "Suspended") return [];
  return person.grants.filter((g) => g.from <= today && (g.until === null || g.until >= today));
}

/** The platforms a person can actually sign in to today. */
export function platformsFor(person: Person, today: string): Platform[] {
  const live = liveGrants(person, today);
  const set = new Set<Platform>();
  for (const g of live) {
    const def = roleByKey(g.role);
    if (def) set.add(def.platform);
  }
  return [...set];
}

/**
 * Rule 1, as a function. Opening a patient record requires a care role — and
 * nothing else does it. No administrative role, at any level, returns true.
 */
export function mayOpenPatientRecord(person: Person, today: string): boolean {
  return liveGrants(person, today).some((g) => roleByKey(g.role)?.platform === "care");
}

/** Rule 2. Administering access is a role of its own, and it reads no content. */
export const isAccessAdministrator = (person: Person, today: string): boolean =>
  liveGrants(person, today).some((g) => g.role === "access-admin");

/**
 * Every reason a proposed grant would be refused. Empty means it is allowed.
 * Written as a list rather than a boolean so a screen can say why.
 */
export function grantRefusals(
  person: Person,
  grant: RoleGrant,
  grantedByIsAccessAdmin: boolean,
): string[] {
  const out: string[] = [];
  const def = roleByKey(grant.role);

  if (!def) {
    out.push("That role does not exist.");
    return out;
  }
  if (!grantedByIsAccessAdmin) {
    out.push("Only an access administrator may grant a role.");
  }
  if (person.status === "Left") {
    out.push("This person has left. Nothing can be granted to them.");
  }
  if (person.status === "Suspended") {
    out.push("This person is suspended. Lift the suspension before granting anything.");
  }
  if (needsEndDate(person.employment) && grant.until === null) {
    out.push(
      `${person.employment} staff must be given an end date: access ends when the assignment does.`,
    );
  }
  if (person.employment === "External" && !def.external) {
    out.push("This role cannot be held by someone with no employment contract with the group.");
  }
  if (grant.until !== null && grant.until < grant.from) {
    out.push("The end date is before the start date.");
  }
  return out;
}

/** What a person may do today, for the screen that answers the question. */
export interface AccessSummary {
  platforms: Platform[];
  roles: RoleDef[];
  patientRecords: boolean;
  accessAdmin: boolean;
  expiring: RoleGrant[];
}

export function accessSummary(person: Person, today: string, within = 30): AccessSummary {
  const live = liveGrants(person, today);
  const horizon = new Date(new Date(today + "T12:00:00Z").getTime() + within * 86400000)
    .toISOString()
    .slice(0, 10);
  return {
    platforms: platformsFor(person, today),
    roles: live.map((g) => roleByKey(g.role)).filter((r): r is RoleDef => !!r),
    patientRecords: mayOpenPatientRecord(person, today),
    accessAdmin: isAccessAdministrator(person, today),
    expiring: live.filter((g) => g.until !== null && g.until <= horizon),
  };
}


/**
 * Why a revocation, or a change of status, would be refused. Empty means it is
 * allowed.
 *
 * The two refusals here are a lockout guard rather than a confidentiality
 * rule. Someone who can change their own access can escalate quietly, and an
 * establishment with no access administrator left has no way back.
 */
export function revocationRefusals(
  person: Person,
  everyone: Person[],
  actingId: string,
  today: string,
  losingAccessAdmin: boolean,
): string[] {
  const out: string[] = [];

  if (person.id === actingId) {
    out.push("You cannot change your own access. Ask another administrator.");
  }
  if (losingAccessAdmin) {
    const others = everyone.filter(
      (p) => p.id !== person.id && isAccessAdministrator(p, today),
    );
    if (others.length === 0) {
      out.push(
        "This is the last access administrator. Grant the role to somebody else first, or nobody will be able to grant anything again.",
      );
    }
  }
  return out;
}

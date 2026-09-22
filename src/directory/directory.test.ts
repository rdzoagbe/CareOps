/**
 * The directory, and the four rules that govern access across all three
 * platforms.
 *
 * The first test is the one that keeps the whole architecture honest: a
 * directory entry must carry no salary and nothing clinical. The directory is
 * allowed to see both sides precisely because what comes out of it is thin. If
 * that stops being true, it has quietly become a third copy of everything and
 * the separation between the two sides means nothing.
 */
import { describe, expect, it } from "vitest";
import { buildDataset } from "@/data/seed";
import { buildClinicalDataset } from "@/clinical/data/seed";
import { iso, TODAY, dayAdd } from "@/data/dates";
import { buildDirectory, careRecord, staffRecord } from "./build";
import {
  ROLES, accessSummary, grantRefusals, isAccessAdministrator, liveGrants,
  mayOpenPatientRecord, needsEndDate, platformsFor, revocationRefusals, roleByKey, rolesOn,
} from "./roles";
import { PLATFORMS, type Person, type RoleGrant } from "./types";

const office = buildDataset();
const care = buildClinicalDataset();
const directory = buildDirectory(
  office.employees.map(staffRecord),
  care.clinicians.map(careRecord),
);
const today = iso(TODAY);
const people = directory.people;

const withRole = (key: string): Person =>
  people.find((p) => p.status === "Active" && liveGrants(p, today).some((g) => g.role === key))!;

describe("the directory is a join, not a third copy", () => {
  it("carries no pay and nothing clinical", () => {
    const keys = new Set(people.flatMap((p) => Object.keys(p)));
    for (const forbidden of [
      "salary", "pay", "iban", "contractEnd", "credential",
      "patient", "diagnos", "prescription", "allerg", "ins",
    ]) {
      expect([...keys].some((k) => k.toLowerCase().includes(forbidden))).toBe(false);
    }
    const blob = JSON.stringify(people);
    expect(blob).not.toMatch(/PAT-\d/);
    expect(blob).not.toMatch(/DEMO-NOT-AN-INS/);
    expect(blob).not.toMatch(/RX-\d/);
  });

  it("keeps a reference to each side rather than a copy of it", () => {
    const both = people.filter((p) => p.employeeRef && p.clinicianRef);
    expect(both.length).toBeGreaterThan(20);
    for (const p of people) {
      if (p.employeeRef) expect(p.employeeRef).toMatch(/^EMP-/);
      if (p.clinicianRef) expect(p.clinicianRef).toMatch(/^PRO-/);
    }
  });

  it("gives every clinician and every employee exactly one entry", () => {
    expect(new Set(people.map((p) => p.id)).size).toBe(people.length);
    const clinicianRefs = people.map((p) => p.clinicianRef).filter(Boolean);
    expect(new Set(clinicianRefs).size).toBe(clinicianRefs.length);
    expect(clinicianRefs).toHaveLength(care.clinicians.length);

    const employeeRefs = people.map((p) => p.employeeRef).filter(Boolean);
    expect(new Set(employeeRefs).size).toBe(employeeRefs.length);
    expect(employeeRefs).toHaveLength(office.employees.length);
  });

  it("is deterministic", () => {
    const again = buildDirectory(
      office.employees.map(staffRecord),
      care.clinicians.map(careRecord),
    );
    expect(JSON.stringify(again)).toBe(JSON.stringify(directory));
  });
});

describe("rule 1: a role on one platform grants nothing on another", () => {
  it("lets no administrative role open a patient record", () => {
    for (const role of rolesOn("admin")) {
      const holders = people.filter(
        (p) =>
          liveGrants(p, today).some((g) => g.role === role.key) &&
          !liveGrants(p, today).some((g) => roleByKey(g.role)?.platform === "care"),
      );
      for (const p of holders) expect(mayOpenPatientRecord(p, today)).toBe(false);
    }
  });

  it("says so on the most senior role of all", () => {
    const director = withRole("ops-director");
    expect(director).toBeDefined();
    expect(mayOpenPatientRecord(director, today)).toBe(false);
    expect(roleByKey("ops-director")!.cannot.join(" ")).toMatch(/patient record/i);
  });

  it("gives every care role a refusal about pay or contracts", () => {
    for (const role of rolesOn("care")) {
      expect(role.cannot.join(" ")).toMatch(/pay|contract/i);
    }
  });

  it("states a refusal on every role in the catalogue", () => {
    // A role that cannot do anything wrong has not been thought about.
    for (const role of ROLES) {
      expect(role.cannot.length).toBeGreaterThan(0);
      expect(role.sees.length).toBeGreaterThan(0);
      expect(PLATFORMS.map((p) => p.key)).toContain(role.platform);
    }
  });
});

describe("rule 2: whoever administers access never reads content", () => {
  const admin = ROLES.find((r) => r.key === "access-admin")!;

  it("closes patient records, personnel files and pay to the access administrator", () => {
    const text = admin.cannot.join(" ").toLowerCase();
    expect(text).toContain("patient record");
    expect(text).toContain("personnel file");
    expect(text).toContain("pay");
  });

  it("lets nobody else grant a role", () => {
    const director = withRole("ops-director");
    const target = withRole("nurse");
    const grant: RoleGrant = {
      role: "hr", facility: target.facility, service: null, from: today, until: null,
      grantedBy: director.name,
    };
    expect(isAccessAdministrator(director, today)).toBe(false);
    expect(grantRefusals(target, grant, false)).toContain("Only an access administrator may grant a role.");
    expect(grantRefusals(target, grant, true)).not.toContain("Only an access administrator may grant a role.");
  });

  it("has exactly one access administrator in the demo, and they hold no care role", () => {
    const admins = people.filter((p) => isAccessAdministrator(p, today));
    expect(admins).toHaveLength(1);
    expect(mayOpenPatientRecord(admins[0], today)).toBe(false);
  });
});

describe("rule 3: access that is not permanent has an end date", () => {
  it("refuses an open-ended grant to anyone temporary", () => {
    const temporary = people.find((p) => needsEndDate(p.employment))!;
    expect(temporary).toBeDefined();
    const open: RoleGrant = {
      role: "staff", facility: temporary.facility, service: null, from: today, until: null,
      grantedBy: "admin",
    };
    expect(grantRefusals(temporary, open, true).join(" ")).toMatch(/end date/i);

    const dated = { ...open, until: iso(dayAdd(90)) };
    expect(grantRefusals(temporary, dated, true)).toEqual([]);
  });

  it("gives every temporary person's grants an end date already", () => {
    for (const p of people) {
      if (!needsEndDate(p.employment)) continue;
      for (const g of p.grants) {
        if (g.grantedBy === "Direction") continue;
        expect(g.until).not.toBeNull();
      }
    }
  });

  it("stops counting a grant once its end date has passed", () => {
    const expired = people.find((p) =>
      p.status === "Active" &&
      p.grants.length > 0 &&
      p.grants.every((g) => g.until !== null && g.until < today),
    );
    if (expired) {
      expect(liveGrants(expired, today)).toHaveLength(0);
      expect(platformsFor(expired, today)).toHaveLength(0);
      expect(mayOpenPatientRecord(expired, today)).toBe(false);
    }
    // And the rule itself, on a made-up entry, so the test does not depend on
    // the generator happening to produce one.
    const person: Person = {
      id: "PSN-TEST", name: "T. Test", facility: "PAR", service: "ICU",
      employment: "Agency", status: "Active",
      grants: [{ role: "nurse", facility: "PAR", service: "ICU", from: iso(dayAdd(-200)), until: iso(dayAdd(-1)), grantedBy: "admin" }],
      employeeRef: null, clinicianRef: null,
    };
    expect(mayOpenPatientRecord(person, today)).toBe(false);
    person.grants[0].until = iso(dayAdd(30));
    expect(mayOpenPatientRecord(person, today)).toBe(true);
  });

  it("refuses a role to someone with no employment contract unless it allows it", () => {
    const external = people.find((p) => p.employment === "External")!;
    expect(external).toBeDefined();
    const hr: RoleGrant = { role: "hr", facility: external.facility, service: null, from: today, until: iso(dayAdd(90)), grantedBy: "admin" };
    expect(grantRefusals(external, hr, true).join(" ")).toMatch(/no employment contract/i);

    const osteo: RoleGrant = { ...hr, role: "osteopath" };
    expect(grantRefusals(external, osteo, true)).toEqual([]);
  });
});

describe("rule 4: leaving or suspension closes every platform at once", () => {
  it("removes every live grant, on all three platforms", () => {
    const person: Person = {
      id: "PSN-TEST2", name: "T. Test", facility: "PAR", service: "ICU",
      employment: "Permanent", status: "Active",
      grants: [
        { role: "nurse", facility: "PAR", service: "ICU", from: iso(dayAdd(-200)), until: null, grantedBy: "admin" },
        { role: "staff", facility: "PAR", service: "ICU", from: iso(dayAdd(-200)), until: null, grantedBy: "admin" },
        { role: "hr", facility: "PAR", service: null, from: iso(dayAdd(-200)), until: null, grantedBy: "admin" },
      ],
      employeeRef: "EMP-0001", clinicianRef: "PRO-0001",
    };
    expect(platformsFor(person, today).sort()).toEqual(["admin", "app", "care"]);

    for (const status of ["Suspended", "Left"] as Person["status"][]) {
      const stopped = { ...person, status };
      expect(liveGrants(stopped, today)).toHaveLength(0);
      expect(platformsFor(stopped, today)).toHaveLength(0);
      expect(mayOpenPatientRecord(stopped, today)).toBe(false);
      expect(isAccessAdministrator(stopped, today)).toBe(false);
    }
  });

  it("refuses to grant anything to someone suspended or gone", () => {
    const grant: RoleGrant = { role: "staff", facility: "PAR", service: null, from: today, until: null, grantedBy: "admin" };
    for (const status of ["Suspended", "Left"] as Person["status"][]) {
      const person: Person = {
        id: "PSN-TEST3", name: "T. Test", facility: "PAR", service: "ICU",
        employment: "Permanent", status, grants: [], employeeRef: null, clinicianRef: null,
      };
      expect(grantRefusals(person, grant, true).length).toBeGreaterThan(0);
    }
  });

  it("keeps the grants on the record so the history is not lost", () => {
    // Revocation by status is not deletion: what someone held stays readable,
    // which is what an audit needs.
    const closed = people.filter((p) => p.status === "Suspended" || p.status === "Left");
    expect(closed.length).toBeGreaterThan(0);
    expect(closed.some((p) => p.grants.length > 0)).toBe(true);
  });
});

describe("the three platforms are actually populated", () => {
  it("has people on each, and people on more than one", () => {
    const counts = Object.fromEntries(PLATFORMS.map((p) => [p.key, 0])) as Record<string, number>;
    let multi = 0;
    for (const p of people) {
      const s = accessSummary(p, today);
      for (const pl of s.platforms) counts[pl] += 1;
      if (s.platforms.length > 1) multi += 1;
    }
    for (const pl of PLATFORMS) expect(counts[pl.key]).toBeGreaterThan(20);
    expect(multi).toBeGreaterThan(50);
  });

  it("has staff who come in only for extra shifts", () => {
    const bank = people.filter((p) => p.employment === "Bank");
    expect(bank.length).toBeGreaterThan(5);
    const role = roleByKey("bank")!;
    expect(role.platform).toBe("app");
    expect(role.cannot.join(" ")).toMatch(/full service rota/i);
  });

  it("has external practitioners, who get no staff app", () => {
    const external = people.filter((p) => p.employment === "External");
    expect(external.length).toBeGreaterThan(5);
    for (const p of external) {
      expect(platformsFor(p, today).includes("app")).toBe(false);
      expect(p.employeeRef).toBeNull();
    }
  });
});


describe("the lockout guard", () => {
  // Found by suspending the access administrator while acting as them: the
  // screen lost the only person who could undo it. Nobody may change their own
  // access, and the last administrator cannot be removed.
  const admin = people.find((p) => isAccessAdministrator(p, today))!;

  it("stops anyone changing their own access", () => {
    const target = withRole("nurse");
    expect(revocationRefusals(target, people, target.id, today, false).join(" ")).toMatch(
      /cannot change your own access/i,
    );
    expect(revocationRefusals(target, people, admin.id, today, false)).toEqual([]);
  });

  it("stops the last access administrator being removed", () => {
    // Removing them while another exists is fine.
    const second: Person = {
      ...admin,
      id: "PSN-SECOND",
      grants: [{ role: "access-admin", facility: "ALL", service: null, from: iso(dayAdd(-10)), until: null, grantedBy: "Direction" }],
    };
    expect(revocationRefusals(admin, [...people, second], "PSN-SECOND", today, true)).toEqual([]);

    // Removing the only one is not.
    expect(revocationRefusals(admin, people, "PSN-OTHER", today, true).join(" ")).toMatch(
      /last access administrator/i,
    );
  });

  it("does not block an ordinary revocation on the administrator", () => {
    // Their other roles are not the one that locks the door.
    expect(revocationRefusals(admin, people, "PSN-OTHER", today, false)).toEqual([]);
  });
});

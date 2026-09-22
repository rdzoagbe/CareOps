/**
 * Builds the synthetic care dataset: fictional patients, fictional clinicians,
 * and the record each one has.
 *
 * Its own generator, seeded with 130477, so it cannot perturb the back-office
 * dataset's call order — that ordering is a data contract (see
 * `src/data/seed.ts`). The two sides share nothing but the list of sites.
 *
 * Every person here is invented. Every identifier that stands in for a
 * national health identifier carries `DEMO_NOT_AN_INS_PREFIX` so it cannot be
 * confused with a real one.
 */
import { FACILITIES } from "@/data/constants";
import { dayAdd, iso, TODAY } from "@/data/dates";
import {
  ADMIN_NOTES, ADMISSION_REASONS, ALLERGIES, AUTONOMY_RANK, CARE_TASKS, DEMO_INS_PREFIX,
  DIAGNOSIS_LABELS, DOC_TYPES, FORMULARY, MOBILITY, NURSE_NOTES, REHAB_DIAGNOSES, REHAB_NOTES,
} from "./formulary";
import type {
  Administration, CarePlanTask, CareRole, Clinician, ClinicalDataset, ClinicalDocument,
  Diagnosis, FileAccess, Observation, Patient, Prescription,
} from "./types";

/** A small generator of its own, same shape as the back office's. */
class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed; }
  next(): number { this.s = (this.s * 1664525 + 1013904223) % 4294967296; return this.s / 4294967296; }
  int(a: number, b: number): number { return a + Math.floor(this.next() * (b - a + 1)); }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.next() * xs.length)]; }
  chance(p: number): boolean { return this.next() < p; }
  some<T>(xs: readonly T[], n: number): T[] {
    const pool = [...xs];
    const out: T[] = [];
    for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0]);
    return out;
  }
}

export const CLINICAL_SEED = 130477;

/** The services that hold patients. Pharmacy and the labs do not. */
export const CARE_SERVICES = ["Emergency", "ICU", "Surgery", "Maternity", "Radiology"];

const PFIRST = [
  "Renée", "Abdel", "Josette", "Malik", "Suzanne", "Théo", "Margot", "Ibrahim", "Colette", "Nour",
  "Gérard", "Fatima", "Lucien", "Awa", "Simone", "Youssef", "Madeleine", "Bruno", "Hélène", "Samir",
  "Jeanne", "Pascal", "Odette", "Kader", "Bernadette", "Étienne", "Rosa", "Hugo", "Lucie", "Armand",
];

const PLAST = [
  "Berger", "Nguyen", "Faure", "Cissé", "Maillard", "Roy", "Lemoine", "Bouchard", "Vidal", "Keita",
  "Garnier", "Pons", "Delaunay", "Sow", "Charpentier", "Meunier", "Lopez", "Brun", "Aubert", "Diarra",
];

const CFIRST = [
  "Anne", "Farid", "Isabelle", "Damien", "Salma", "Grégoire", "Maya", "Vincent", "Noémie", "Tariq",
  "Émilie", "Sébastien", "Laure", "Amine", "Sandrine", "Joachim",
];

const CLAST = [
  "Rambert", "Ouedraogo", "Salas", "Thibault", "Mercier", "Doucet", "Vasquez", "Lambert",
  "Ferreira", "Nkemdirim", "Caron", "Weiss",
];

/** How many of each profession a service gets, per site. */
const TEAM_SHAPE: { role: CareRole; n: number }[] = [
  { role: "Doctor", n: 2 },
  { role: "Nurse", n: 4 },
  { role: "Care assistant", n: 3 },
  { role: "Physiotherapist", n: 1 },
  { role: "Osteopath", n: 1 },
];

const pad = (n: number, l: number) => String(n).padStart(l, "0");

/** "2026-09-20T08:30" — local-free, like every other date in this project. */
const at = (dayOffset: number, hour: number, minute = 0): string =>
  `${iso(dayAdd(dayOffset))}T${pad(hour, 2)}:${pad(minute, 2)}`;

export function buildClinicalDataset(seed: number = CLINICAL_SEED): ClinicalDataset {
  const rng = new Rng(seed);

  const clinicians: Clinician[] = [];
  const patients: Patient[] = [];
  const diagnoses: Diagnosis[] = [];
  const prescriptions: Prescription[] = [];
  const administrations: Administration[] = [];
  const tasks: CarePlanTask[] = [];
  const observations: Observation[] = [];
  const documents: ClinicalDocument[] = [];
  const access: FileAccess[] = [];

  /* ---- clinicians ---- */
  for (const f of FACILITIES) {
    for (const service of CARE_SERVICES) {
      for (const shape of TEAM_SHAPE) {
        for (let i = 0; i < shape.n; i++) {
          const name = `${rng.pick(CFIRST)} ${rng.pick(CLAST)}`;
          clinicians.push({
            id: "PRO-" + pad(clinicians.length + 1, 4),
            name: shape.role === "Doctor" ? "Dr " + name : name,
            role: shape.role,
            facility: f.id,
            service,
            registration: "DEMO-REG-" + pad(clinicians.length + 1, 6),
          });
        }
      }
    }
  }

  const teamAt = (facility: string, service: string, role: CareRole) =>
    clinicians.filter((c) => c.facility === facility && c.service === service && c.role === role);

  /* ---- patients, and the record of each ---- */
  for (const f of FACILITIES) {
    // Generated per service rather than by drawing a service at random, so no
    // service at any site can come out empty — a rehabilitation professional
    // signing in to a ward with no patients makes the product look broken when
    // it is only the demo data that is thin.
    const perService = Math.max(5, Math.round(f.beds / 70));
    for (const service of CARE_SERVICES) {
      for (let i = 0; i < perService; i++) {
        const id = "PAT-" + pad(patients.length + 1, 4);
        const admittedDays = rng.int(1, 21);
        const status =
          service === "Radiology" ? (rng.chance(0.7) ? "Day case" : "Outpatient")
          : rng.chance(0.88) ? "Inpatient"
          : "Day case";
        const autonomy =
          rng.chance(0.42) ? "Independent" : rng.chance(0.62) ? "Needs help" : "Fully dependent";

        const doctors = teamAt(f.id, service, "Doctor");
        const nurses = teamAt(f.id, service, "Nurse");
        const assistants = teamAt(f.id, service, "Care assistant");
        const physios = teamAt(f.id, service, "Physiotherapist");
        const osteos = teamAt(f.id, service, "Osteopath");

        const mainDx = rng.pick(DIAGNOSIS_LABELS);
        // The first patient of every service always has a rehabilitation
        // professional on the team, for the same reason.
        const needsRehab = i === 0 || REHAB_DIAGNOSES.includes(mainDx) || rng.chance(0.25);

        const careTeam = [
          rng.pick(doctors).id,
          ...rng.some(nurses, 2).map((c) => c.id),
          ...rng.some(assistants, autonomy === "Independent" ? 1 : 2).map((c) => c.id),
          ...(needsRehab ? [rng.pick(physios).id] : []),
          ...(needsRehab && rng.chance(0.35) ? [rng.pick(osteos).id] : []),
        ];

        const born = iso(new Date(Date.UTC(TODAY.getUTCFullYear() - rng.int(19, 93), rng.int(0, 11), rng.int(1, 28), 12)));

        patients.push({
          id,
          ins: DEMO_INS_PREFIX + pad(patients.length + 1, 8),
          name: `${rng.pick(PFIRST)} ${rng.pick(PLAST)}`,
          born,
          sex: rng.chance(0.53) ? "F" : "M",
          facility: f.id,
          service,
          room: `${service.slice(0, 3).toUpperCase()}-${pad(rng.int(1, 40), 2)}${rng.pick(["a", "b"])}`,
          admitted: iso(dayAdd(-admittedDays)),
          expectedDischarge: status === "Inpatient" ? iso(dayAdd(rng.int(0, 9))) : null,
          status: status as Patient["status"],
          reason: rng.pick(ADMISSION_REASONS),
          careTeam,
          referrer: "Dr " + rng.pick(CLAST),
          allergies: rng.chance(0.28) ? rng.some(ALLERGIES, rng.int(1, 2)) : [],
          autonomy: autonomy as Patient["autonomy"],
          mobility: rng.pick(MOBILITY),
          consent: {
            share: rng.chance(0.93),
            research: rng.chance(0.34),
            trustedPerson: rng.chance(0.72) ? `${rng.pick(PFIRST)} ${rng.pick(PLAST)}` : null,
          },
        });

        /* diagnoses */
        const prescriber = careTeam[0];
        diagnoses.push({
          id: "DX-" + pad(diagnoses.length + 1, 5), patient: id, label: mainDx,
          since: iso(dayAdd(-admittedDays)), by: prescriber, kind: "Main",
        });
        for (const label of rng.some(DIAGNOSIS_LABELS.filter((d) => d !== mainDx), rng.int(0, 2))) {
          diagnoses.push({
            id: "DX-" + pad(diagnoses.length + 1, 5), patient: id, label,
            since: iso(dayAdd(-rng.int(200, 3000))), by: prescriber,
            kind: rng.chance(0.5) ? "Associated" : "History",
          });
        }

        /* prescriptions, and what was actually given */
        for (const entry of rng.some(FORMULARY, rng.int(2, 5))) {
          const startedDays = rng.int(0, admittedDays);
          const stopped = rng.chance(0.12);
          const pres: Prescription = {
            id: "RX-" + pad(prescriptions.length + 1, 5),
            patient: id,
            drug: entry.drug,
            form: entry.form,
            dose: rng.pick(entry.doses),
            route: entry.route,
            frequency: rng.pick(entry.frequencies),
            started: iso(dayAdd(-startedDays)),
            ends: stopped ? iso(dayAdd(-rng.int(0, startedDays))) : null,
            prescriber,
            status: stopped ? "Stopped" : "Active",
            indication: rng.pick(entry.indications),
          };
          prescriptions.push(pres);

          if (pres.status !== "Active") continue;
          for (let day = Math.min(startedDays, 3); day >= 0; day--) {
            for (const hour of [8, 14, 20].slice(0, rng.int(1, 3))) {
              const refused = rng.chance(0.05);
              const missed = !refused && rng.chance(0.04);
              administrations.push({
                id: "ADM-" + pad(administrations.length + 1, 6),
                prescription: pres.id,
                patient: id,
                at: at(-day, hour, rng.int(0, 45)),
                by: rng.pick(nurses).id,
                status: refused ? "Refused by patient" : missed ? "Not given" : "Given",
                note: refused || missed ? rng.pick(ADMIN_NOTES) : rng.chance(0.12) ? rng.pick(ADMIN_NOTES) : null,
              });
            }
          }
        }

        /* today's care plan */
        for (const t of CARE_TASKS) {
          if (AUTONOMY_RANK[autonomy] < AUTONOMY_RANK[t.minAutonomy]) continue;
          const hour = t.frequency.includes("morning") ? 8 : rng.int(7, 19);
          const done = hour <= 12;
          tasks.push({
            id: "TSK-" + pad(tasks.length + 1, 6),
            patient: id,
            kind: t.kind,
            title: t.title,
            due: `${pad(hour, 2)}:00`,
            frequency: t.frequency,
            role: t.role,
            done,
            by: done ? rng.pick(t.role === "Nurse" ? nurses : assistants).id : null,
          });
        }

        /* observations: vitals rounds, nursing notes, rehab sessions */
        for (let day = 2; day >= 0; day--) {
          for (const hour of [7, 14, 21]) {
            const nurse = rng.pick(nurses);
            observations.push({
              id: "OBS-" + pad(observations.length + 1, 6),
              patient: id, at: at(-day, hour, rng.int(0, 30)), by: nurse.id, role: "Nurse",
              kind: "Vitals",
              temperature: Math.round((36.2 + rng.next() * 1.6) * 10) / 10,
              pulse: rng.int(54, 104),
              systolic: rng.int(98, 158),
              diastolic: rng.int(54, 94),
              pain: rng.int(0, 6),
              text: null,
            });
          }
          if (rng.chance(0.7)) {
            observations.push({
              id: "OBS-" + pad(observations.length + 1, 6),
              patient: id, at: at(-day, rng.int(9, 20), rng.int(0, 50)),
              by: rng.pick(nurses).id, role: "Nurse", kind: "Note",
              temperature: null, pulse: null, systolic: null, diastolic: null, pain: null,
              text: rng.pick(NURSE_NOTES),
            });
          }
          if (needsRehab && rng.chance(0.6)) {
            const pro = rng.pick(rng.chance(0.75) ? physios : osteos);
            observations.push({
              id: "OBS-" + pad(observations.length + 1, 6),
              patient: id, at: at(-day, rng.int(10, 17), rng.int(0, 45)),
              by: pro.id, role: pro.role, kind: "Rehab",
              temperature: null, pulse: null, systolic: null, diastolic: null, pain: rng.int(0, 5),
              text: rng.pick(REHAB_NOTES),
            });
          }
        }

        /* documents */
        for (const type of rng.some(DOC_TYPES, rng.int(1, 4))) {
          documents.push({
            id: "CDOC-" + pad(documents.length + 1, 5),
            patient: id, type,
            date: iso(dayAdd(-rng.int(0, admittedDays))),
            author: rng.pick(clinicians.filter((c) => c.facility === f.id)).name,
            summary: type + " filed in the record.",
          });
        }

        /* who has already opened this record */
        for (const who of rng.some(careTeam, Math.min(careTeam.length, rng.int(2, 4)))) {
          const pro = clinicians.find((c) => c.id === who)!;
          access.push({
            id: "ACC-" + pad(access.length + 1, 6),
            patient: id,
            at: at(-rng.int(0, 2), rng.int(7, 21), rng.int(0, 59)),
            who,
            role: pro.role,
            classes: [],
            basis: "Care team",
            reason: "Care in progress",
          });
        }
        // One record in fifteen was opened by someone declaring an emergency.
        if (rng.chance(0.07)) {
          const outsider = rng.pick(clinicians.filter((c) => c.facility === f.id && !careTeam.includes(c.id)));
          access.push({
            id: "ACC-" + pad(access.length + 1, 6),
            patient: id,
            at: at(-rng.int(0, 3), rng.int(0, 23), rng.int(0, 59)),
            who: outsider.id,
            role: outsider.role,
            classes: [],
            basis: "Emergency access",
            reason: "Covering a colleague who is unavailable",
          });
        }
      }
    }
  }

  access.sort((a, b) => b.at.localeCompare(a.at));
  return { clinicians, patients, diagnoses, prescriptions, administrations, tasks, observations, documents, access };
}

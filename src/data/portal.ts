/**
 * Employee portal domain: the state the employer console and the employee app
 * both read and write.
 *
 * Two existing employee records are overwritten with the two storyline
 * employees rather than appended, so every headcount figure in the console
 * stays identical to the generated dataset.
 */
import { Lcg } from "./random";
import { dayAdd, iso, daysTo } from "./dates";
import { pad } from "./format";
import { CLINICAL } from "./constants";
import type { Dataset, Employee } from "./types";

export const NOWT = "10:14";

/** The demo week, Monday 21 to Sunday 27 September 2026. */
export const WK: [string, string, number][] = [
  ["2026-09-21", "Mon", 21], ["2026-09-22", "Tue", 22], ["2026-09-23", "Wed", 23],
  ["2026-09-24", "Thu", 24], ["2026-09-25", "Fri", 25], ["2026-09-26", "Sat", 26],
  ["2026-09-27", "Sun", 27],
];

export type ShiftKind = "D" | "N" | "O" | "X";

export const SH: Record<ShiftKind, { l: string; h: string; c: string }> = {
  D: { l: "Day shift", h: "07:00 – 19:00", c: "#f3c85a" },
  N: { l: "Night shift", h: "19:00 – 07:00", c: "#4b5fb8" },
  O: { l: "Rest day", h: "", c: "transparent" },
  X: { l: "Absence declared", h: "Shift released, your manager is informed", c: "#d0453b" },
};

/* ---------- contract clause library ----------
   The AI contract revision may only ever select from this library. It cannot
   author legal text, and it can never touch PAY. See docs/RULES.md.          */

export interface ClauseVariant {
  id: string;
  x: string;
  /** Annual cost delta in euros, where the variant has one. */
  cost?: number;
}

export const CLS: Record<string, { t: string; v: ClauseVariant[] }> = {
  POS: { t: "Position and duties", v: [{ id: "POS-1", x: "The employee is hired as a registered nurse in the Emergency department of St. Gabriel Paris Central. Duties are set out in the attached job description." }] },
  TERM: { t: "Term", v: [{ id: "TERM-1", x: "This fixed-term contract runs for twelve months, from 1 October 2026 to 30 September 2027, to cover a temporary increase in activity." }] },
  TRIAL: { t: "Trial period", v: [{ id: "TRIAL-1", x: "The contract includes a one-month trial period, during which either party may end it without notice pay." }] },
  HOURS: { t: "Working time", v: [{ id: "HOURS-1", x: "The employee works full time on a 12-hour shift pattern, alternating day and night shifts according to the department rota." }] },
  NIGHT: {
    t: "Night work",
    v: [
      { id: "NIGHT-1", x: "The employee may be scheduled on night shifts with no limit on their share of the rota cycle.", cost: 0 },
      { id: "NIGHT-2", x: "Night shifts are limited to 50% of the rota cycle, unless the employee agrees otherwise for a given period.", cost: -1140 },
    ],
  },
  SITE: {
    t: "Place of work",
    v: [
      { id: "SITE-1", x: "The employee is based at St. Gabriel Paris Central and may be asked to work at other St. Gabriel facilities.", cost: 0 },
      { id: "SITE-2", x: "The employee is based at St. Gabriel Paris Central. Any assignment to another facility requires the employee's prior written agreement.", cost: 0 },
    ],
  },
  PAY: { t: "Pay", v: [{ id: "PAY-1", x: "Pay follows the nursing pay grid, band 3: €2,480 gross per month, plus shift and night allowances." }] },
  CONF: { t: "Confidentiality", v: [{ id: "CONF-1", x: "The employee is bound by professional secrecy for everything learned in the course of their work." }] },
  DISC: { t: "Right to disconnect", v: [{ id: "DISC-1", x: "Outside working hours the employee is not expected to answer work messages. The app sends no non-urgent notification between 21:00 and 07:00." }] },
};

export const CLS_ORDER = ["POS", "TERM", "TRIAL", "HOURS", "NIGHT", "SITE", "PAY", "CONF", "DISC"];

/** The clause AI is never allowed to change. */
export const PROTECTED_CLAUSES = ["PAY"];

export const clsText = (id: string): ClauseVariant => {
  for (const k of Object.keys(CLS)) {
    const v = CLS[k].v.find((x) => x.id === id);
    if (v) return v;
  }
  return { id, x: "" };
};

/* ---------- renewals register ---------- */

export interface RenewalType {
  l: string;
  grp: string;
  lead: number;
  emp: boolean;
  hr?: boolean;
  act: string;
}

export const RTYPE: Record<string, RenewalType> = {
  contract: { l: "Fixed-term contract end", grp: "Contracts", lead: 60, emp: false, act: "Decide: renew, convert to permanent, or let it end as planned." },
  agency: { l: "Agency assignment end", grp: "Contracts", lead: 30, emp: false, act: "Confirm the extension or end with the agency. The worker's contract is with the agency." },
  trial: { l: "Trial period end", grp: "Contracts", lead: 15, emp: false, act: "Confirm the hire with the manager before the trial period ends." },
  licence: { l: "Professional licence", grp: "Credentials", lead: 90, emp: true, act: "Ask the employee for the renewed licence and verify it." },
  register: { l: "Professional register check", grp: "Credentials", lead: 30, emp: true, act: "Check the professional register entry and record the verification date." },
  training: { l: "Mandatory training", grp: "Training", lead: 60, emp: true, act: "Book a session or remind the employee to book one in the app." },
  occ: { l: "Occupational health follow-up", grp: "Health & safety", lead: 30, emp: false, act: "Schedule the visit with occupational health. Only the date and fitness decision are kept." },
  work: { l: "Work authorisation", grp: "Right to work", lead: 120, emp: true, hr: true, act: "Ask the employee for proof of renewal. Record type, number and new expiry. HR only." },
  id: { l: "Identity document (reference)", grp: "Identity", lead: 30, emp: true, hr: true, act: "Only if your policy requires it: record that a valid document was seen. No copy is kept." },
};

export const RSTAT: Record<string, string> = {
  Valid: "mute", "To act": "warn", Requested: "info", Received: "ai", Booked: "info",
  Verified: "ok", "Ends as planned": "mute", "Handled offline": "mute",
};

export interface Renewal {
  id: string;
  emp: string;
  type: string;
  due: string;
  status: string;
  owner: string;
  history: [string, string][];
  title?: string;
  /** Set for the two storyline employees, so actions reach a phone. */
  who?: "A" | "M";
}

const TRAININGS = ["Fire safety", "Hand hygiene", "Patient handling", "AFGSU refresher", "Data protection awareness", "Radiation protection"];

/** Indexes of the two records replaced by the storyline employees. */
export const STORY_IDX = { A: 116, M: 41 } as const;

export function applyStoryEmployees(employees: Employee[]): void {
  Object.assign(employees[STORY_IDX.A], {
    name: "Aïcha Diallo", dept: "Emergency", facility: "PAR", role: "Emergency nurse",
    contract: "CDD", start: "2026-10-01", contractEnd: "2027-09-30", credential: "RN licence",
    credentialEnd: "2029-06-30", training: "Due soon", status: "Active", onboarding: "In progress",
    manager: "Claire Rousseau", email: "aicha.diallo@st-gabriel.demo", fte: 1,
  });
  Object.assign(employees[STORY_IDX.M], {
    name: "Marc Lefèvre", dept: "Emergency", facility: "PAR", role: "Care assistant",
    contract: "CDI", start: "2019-03-04", contractEnd: null, credential: null,
    credentialEnd: null, training: "Due soon", status: "Active", onboarding: "Complete",
    manager: "Claire Rousseau", email: "marc.lefevre@st-gabriel.demo", fte: 1,
  });
}

/**
 * Builds the renewals register. Uses its own generator (seed 424242), exactly
 * as the prototype does, so the register is stable independently of the main
 * dataset.
 */
export function buildRenewals(employees: Employee[]): Renewal[] {
  const rng = new Lcg(424242);
  const rr = () => rng.next();
  const rdays = (a: number, b: number) => a + Math.floor(rr() * (b - a + 1));
  const out: Renewal[] = [];

  const addRen = (e: Employee, type: string, dueDate: string, extra?: Partial<Renewal>) => {
    const d = daysTo(dueDate);
    let st =
      d < -5 && rr() < 0.25 ? "Requested"
      : d < 40 && rr() < 0.18 ? "Requested"
      : d < 20 && rr() < 0.1 ? "Received"
      : "To act";
    if (d < 0 && (type === "contract" || type === "agency") && rr() < 0.7) st = "Ends as planned";
    if (d < 0 && type === "trial") st = "Verified";
    out.push({
      id: "RN-" + pad(out.length + 1, 5), emp: e.id, type, due: dueDate, status: st,
      owner: RTYPE[type].grp === "Training" ? "Training office" : "HR office",
      history: [], ...extra,
    });
  };

  employees.forEach((e, i) => {
    if (i === STORY_IDX.A || i === STORY_IDX.M) return;
    if (e.contractEnd && e.contract !== "CDI") addRen(e, e.contract === "Agency" ? "agency" : "contract", e.contractEnd);
    if (daysTo(e.start) > -110) addRen(e, "trial", iso(new Date(new Date(e.start + "T12:00:00Z").getTime() + 60 * 86400000)));
    if (e.credentialEnd) addRen(e, "licence", e.credentialEnd, { title: e.credential ?? undefined });
    if (CLINICAL.includes(e.dept) && rr() < 0.35) addRen(e, "register", iso(dayAdd(rdays(-12, 300))));
    if (e.training === "Overdue") {
      const d = iso(dayAdd(rdays(-60, -2)));
      addRen(e, "training", d, { title: TRAININGS[Math.floor(rr() * TRAININGS.length)] });
    }
    if (e.training === "Due soon") {
      const d = iso(dayAdd(rdays(5, 55)));
      addRen(e, "training", d, { title: TRAININGS[Math.floor(rr() * TRAININGS.length)] });
    }
    if (rr() < 0.3) addRen(e, "occ", iso(dayAdd(rdays(-10, 360))));
    if (rr() < 0.028) addRen(e, "work", iso(dayAdd(rdays(-8, 330))), { title: "Residence permit, employee" });
    if (rr() < 0.02) addRen(e, "id", iso(dayAdd(rdays(10, 360))));
  });

  const A = employees[STORY_IDX.A];
  const M = employees[STORY_IDX.M];
  out.push(
    { id: "RN-A01", emp: A.id, type: "register", due: "2026-10-01", status: "To act", owner: "HR office", history: [], title: "Nursing register (Ordre national des infirmiers)", who: "A" },
    { id: "RN-A02", emp: A.id, type: "trial", due: "2026-10-31", status: "To act", owner: "HR office", history: [], who: "A" },
    { id: "RN-A03", emp: A.id, type: "contract", due: "2027-09-30", status: "To act", owner: "HR office", history: [], who: "A" },
    { id: "RN-A04", emp: A.id, type: "licence", due: "2029-06-30", status: "Verified", owner: "HR office", history: [["Verified at hiring", "15 Sep"]], title: "RN licence", who: "A" },
    { id: "RN-M01", emp: M.id, type: "training", due: "2026-09-10", status: "To act", owner: "Training office", history: [], title: "Patient handling refresher", who: "M" },
    { id: "RN-M02", emp: M.id, type: "training", due: "2026-10-15", status: "To act", owner: "Training office", history: [], title: "Fire safety", who: "M" },
    { id: "RN-M03", emp: M.id, type: "occ", due: "2026-11-20", status: "To act", owner: "HR office", history: [], who: "M" },
  );
  return out;
}

export const renTitle = (r: Renewal): string => r.title || RTYPE[r.type].l;

/** An item inside its lead window is "To act"; outside it, it is simply valid. */
export const renState = (r: Renewal): string =>
  r.status === "To act" && daysTo(r.due) > RTYPE[r.type].lead ? "Valid" : r.status;

export const renOpen = (r: Renewal): boolean =>
  !["Verified", "Ends as planned", "Handled offline"].includes(r.status);

/* ---------- portal state ---------- */

export interface PortalRequest {
  id: string;
  who: "A" | "M" | null;
  emp: string;
  type: string;
  title: string;
  status: string;
  at: string;
  unreadReply?: boolean;
  thread: { from: "emp" | "hr"; t: string; at: string }[];
}

export interface PayVariable {
  id: string;
  emp: string;
  label: string;
  days: number;
  st: "Proposed" | "Validated" | "Disputed";
  src: string;
}

export interface Absence {
  id: string;
  who: "A" | "M";
  type: string;
  dates: string[];
  proof: boolean;
  covered: boolean;
  pv: string;
}

export interface ContractState {
  id: string;
  who: "A" | "M";
  type: string;
  status: string;
  sent: string;
  versions: { n: number; clauses: Record<string, string>; hash: string; at: string }[];
  comments: { c: string; t: string }[];
  proposal: null | { clauses: Record<string, string>; why: { k: string; why: string }[]; source: string };
  changedWhy?: { k: string; why: string }[];
  signed: null | { at: string };
  gross: number;
  allowances: number;
  history: [string, string][];
}

export type StoryFlag =
  | "activated" | "commented" | "v2" | "signed" | "absence" | "covered"
  | "validated" | "leave" | "cert" | "privacy" | "renreq" | "renver";

/** The twelve-step demo storyline shown on the portal overview. */
export const STORY: [StoryFlag, string, string][] = [
  ["activated", "Aïcha opens her invitation email and activates her account", "Phone"],
  ["commented", "Aïcha comments on two contract clauses and sends her remarks", "Phone"],
  ["v2", "HR asks the AI for a revision, checks it and sends version 2", "Employer › Contracts"],
  ["signed", "Aïcha signs version 2 and it files itself in her record", "Phone"],
  ["leave", "Marc requests paid leave, or a certificate, from the Requests tab", "Phone, switch to Marc"],
  ["cert", "HR answers the request, the result appears on Marc's phone", "Employer › Requests"],
  ["absence", "Marc declares an absence for two upcoming shifts", "Phone"],
  ["covered", "HR offers the released shifts to qualified colleagues", "Employer › Absences & pay"],
  ["validated", "HR validates the absence as a payroll variable", "Employer › Absences & pay"],
  ["renreq", "HR requests Aïcha's nursing register proof before she starts", "Employer › Renewals & expiries"],
  ["renver", "Aïcha sends it from her phone, HR verifies it", "Phone, then Renewals"],
  ["privacy", "Marc checks who opened his file, and why", "Phone › Me"],
];

export interface PortalState {
  ppl: Record<"A" | "M", { idx: number; first: string; phone: string; personal: string; account: string; lang: string }>;
  contract: ContractState;
  shifts: Record<"A" | "M", Record<string, ShiftKind>>;
  confirm: { who: "A" | "M"; d: string; k: ShiftKind; st: string; note: string }[];
  open: { id: string; d: string; k: ShiftKind; dept: string; why: string; status: string; taker: string | null }[];
  leave: Record<"A" | "M", { k: string; l: string; total: number; used: number; note?: string }[]>;
  requests: PortalRequest[];
  docs: Record<"A" | "M", [string, string][]>;
  training: Record<"A" | "M", { t: string; due: string; st: string; dur: string }[]>;
  hours: { M: { planned: number; worked: number; night: number; extra: number; label: string } };
  notifs: Record<"A" | "M", { t: string; b: string; tab: string; read: boolean; at: string }[]>;
  news: { t: string; b: string; at: string }[];
  access: { who: "A" | "M"; by: string; why: string; at: string }[];
  absences: Absence[];
  payvars: PayVariable[];
  flags: Record<StoryFlag, boolean>;
}

export function buildPortalState(db: Dataset): PortalState {
  const emp = (idx: number) => db.employees[idx];

  const state: PortalState = {
    ppl: {
      A: { idx: STORY_IDX.A, first: "Aïcha", phone: "+33 6 •• •• •• 42", personal: "aicha.diallo@mail.fr", account: "invited", lang: "English" },
      M: { idx: STORY_IDX.M, first: "Marc", phone: "+33 6 •• •• •• 17", personal: "marc.lefevre@st-gabriel.demo", account: "active", lang: "English" },
    },
    contract: {
      id: "CTR-2026-118", who: "A", type: "Fixed-term contract (CDD)", status: "Sent", sent: "20 Sep, 09:02",
      versions: [{
        n: 1,
        clauses: { POS: "POS-1", TERM: "TERM-1", TRIAL: "TRIAL-1", HOURS: "HOURS-1", NIGHT: "NIGHT-1", SITE: "SITE-1", PAY: "PAY-1", CONF: "CONF-1", DISC: "DISC-1" },
        hash: "7c1e…a94f", at: "20 Sep, 09:02",
      }],
      comments: [], proposal: null, signed: null, gross: 2480, allowances: 385,
      history: [["Contract prepared and sent", "20 Sep, 09:02"]],
    },
    shifts: {
      M: { "2026-09-21": "D", "2026-09-22": "D", "2026-09-23": "O", "2026-09-24": "N", "2026-09-25": "N", "2026-09-26": "O", "2026-09-27": "O" },
      A: {},
    },
    confirm: [
      { who: "M", d: "2026-09-18", k: "D", st: "To confirm", note: "" },
      { who: "M", d: "2026-09-19", k: "D", st: "To confirm", note: "" },
    ],
    open: [
      { id: "OS-031", d: "2026-09-26", k: "D", dept: "Emergency", why: "Colleague on leave", status: "Open", taker: null },
      { id: "OS-032", d: "2026-09-27", k: "N", dept: "Emergency", why: "Unfilled rota slot", status: "Open", taker: null },
    ],
    leave: {
      M: [
        { k: "paid", l: "Paid leave", total: 25, used: 14 },
        { k: "rtt", l: "RTT days", total: 12, used: 7 },
        { k: "lieu", l: "Time off in lieu", total: 6, used: 2 },
      ],
      A: [{ k: "paid", l: "Paid leave", total: 0, used: 0, note: "Starts accruing on 1 October" }],
    },
    requests: [],
    docs: {
      M: [
        ["Employment contract (CDI)", "2019-03-04"],
        ["Job description, care assistant", "2026-09-02"],
        ["AFGSU level 2 certificate", "2025-05-14"],
        ["Occupational health: fit for work", "2026-01-20"],
        ["Hand hygiene training certificate", "2026-03-11"],
      ],
      A: [
        ["Identity document", "2026-09-15"],
        ["State nursing diploma", "2026-09-15"],
        ["Proof of address", "2026-09-15"],
      ],
    },
    training: {
      M: [
        { t: "Patient handling refresher", due: "2026-09-10", st: "Overdue", dur: "3 h" },
        { t: "Fire safety", due: "2026-10-15", st: "Due soon", dur: "2 h" },
        { t: "Hand hygiene", due: "2027-03-11", st: "Up to date", dur: "1 h" },
        { t: "AFGSU level 2 refresher", due: "2029-05-14", st: "Up to date", dur: "1 day" },
      ],
      A: [
        { t: "Hospital induction day", due: "2026-10-01", st: "Booked", dur: "1 day" },
        { t: "Fire safety", due: "2026-10-08", st: "To book", dur: "2 h" },
        { t: "Emergency department IT systems", due: "2026-10-02", st: "Booked", dur: "3 h" },
      ],
    },
    hours: { M: { planned: 152, worked: 118, night: 22, extra: 3.5, label: "September, to date" } },
    notifs: {
      A: [],
      M: [{ t: "October rota published", b: "Your rota for October is now available.", tab: "schedule", read: true, at: "18 Sep" }],
    },
    news: [
      { t: "Flu vaccination campaign", b: "Free sessions for all staff from 5 October in every facility. No appointment needed.", at: "18 Sep" },
      { t: "New parking badges", b: "Collect your new badge at the Paris Central reception from 28 September.", at: "15 Sep" },
    ],
    access: [
      { who: "M", by: "S. Martin, HR", why: "Job description update", at: "2 Sep, 14:21" },
      { who: "M", by: "System", why: "Monthly payroll variables export", at: "31 Aug, 23:00" },
      { who: "M", by: "S. Martin, HR", why: "Annual review preparation", at: "11 Jun, 09:48" },
    ],
    absences: [], payvars: [],
    flags: {
      activated: false, commented: false, v2: false, signed: false, absence: false,
      covered: false, validated: false, leave: false, cert: false, privacy: false,
      renreq: false, renver: false,
    },
  };

  /* requests from the wider workforce, so the HR inbox is not empty */
  const seedRequests: [string, string, number, string][] = [
    ["Leave", "Paid leave, 12–16 Oct", 62, "New"],
    ["Certificate", "Employment certificate for a rental", 203, "New"],
    ["Document", "Updated RN licence uploaded", 318, "New"],
    ["Swap", "Shift swap, 3 Oct day with 4 Oct", 455, "New"],
    ["Leave", "RTT day, 9 Oct", 512, "Approved"],
    ["Question", "Question about night allowance", 701, "Answered"],
  ];
  seedRequests.forEach(([type, title, i, st], n) => {
    const at = `${12 + n} Sep`;
    state.requests.push({
      id: "RQ-" + (2090 + n), who: null, emp: emp(i).id, type, title, status: st, at,
      thread: [
        { from: "emp", t: title + ".", at },
        ...(st !== "New"
          ? [{
              from: "hr" as const,
              t: st === "Approved"
                ? "Approved. Enjoy your day off."
                : "The night allowance is 10% of the hourly rate, see section 4 of the staff handbook.",
              at: `${13 + n} Sep`,
            }]
          : []),
      ] as PortalRequest["thread"],
    });
  });
  state.requests.push({
    id: "RQ-2077", who: "M", emp: emp(STORY_IDX.M).id, type: "Leave",
    title: "Paid leave, 26–30 Oct", status: "Approved", at: "2 Sep",
    thread: [
      { from: "emp", t: "I would like to take paid leave from 26 to 30 October.", at: "2 Sep" },
      { from: "hr", t: "Approved by Claire Rousseau. Enjoy your break.", at: "3 Sep" },
    ],
  });

  /* payroll variables for other employees, so the HR queue is not empty */
  const seedPv: [string, number, PayVariable["st"]][] = [
    ["Sick leave", 2, "Validated"], ["Child sick", 1, "Proposed"],
    ["Overtime +1 h 30", 0, "Validated"], ["Family event", 1, "Proposed"],
    ["Overtime +0 h 45", 0, "Disputed"],
  ];
  seedPv.forEach(([l, d, st], n) => {
    state.payvars.push({ id: "PV-" + (410 + n), emp: emp(90 + n * 37).id, label: l, days: d, st, src: "Declared in app" });
  });

  return state;
}

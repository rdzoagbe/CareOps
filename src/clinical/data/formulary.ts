/**
 * The fixed libraries the care side picks from. Nothing here is computed and
 * nothing here is authored at runtime.
 *
 * THE LINE THIS FILE EXISTS TO HOLD: CareOps records a prescription a
 * prescriber decided on. It does not suggest a drug, does not calculate or
 * adjust a dose, does not check interactions, allergies or contraindications,
 * and shows no alert about the clinical content of a prescription. Software
 * that does those things is doing a different job and is regulated as such
 * (EU 2017/745) — that is a deliberate product decision, not an omission, and
 * `formulary.test.ts` pins it.
 *
 * Doses below are fictional demo content attached to fictional patients. They
 * are not a reference for anything.
 */

export interface FormularyEntry {
  drug: string;
  form: string;
  route: string;
  /** The choices a prescriber picks between. Never a range to compute from. */
  doses: string[];
  frequencies: string[];
  indications: string[];
  /** Whether this bears on what is safe in a rehabilitation session. */
  rehabRelevant: boolean;
}

export const FORMULARY: FormularyEntry[] = [
  {
    drug: "Paracetamol", form: "tablet", route: "Oral",
    doses: ["500 mg", "1 g"], frequencies: ["up to 4x daily", "3x daily", "at night"],
    indications: ["Pain", "Fever"], rehabRelevant: true,
  },
  {
    drug: "Enoxaparin", form: "pre-filled syringe", route: "Subcutaneous",
    doses: ["4000 IU", "6000 IU"], frequencies: ["once daily"],
    indications: ["Thrombosis prevention"], rehabRelevant: true,
  },
  {
    drug: "Amoxicillin", form: "capsule", route: "Oral",
    doses: ["500 mg", "1 g"], frequencies: ["3x daily", "2x daily"],
    indications: ["Infection"], rehabRelevant: false,
  },
  {
    drug: "Omeprazole", form: "capsule", route: "Oral",
    doses: ["20 mg"], frequencies: ["once daily"],
    indications: ["Gastric protection"], rehabRelevant: false,
  },
  {
    drug: "Furosemide", form: "tablet", route: "Oral",
    doses: ["20 mg", "40 mg"], frequencies: ["once daily", "2x daily"],
    indications: ["Fluid overload"], rehabRelevant: true,
  },
  {
    drug: "Bisoprolol", form: "tablet", route: "Oral",
    doses: ["2.5 mg", "5 mg"], frequencies: ["once daily"],
    indications: ["Blood pressure", "Heart rate control"], rehabRelevant: true,
  },
  {
    drug: "Insulin (rapid)", form: "pen", route: "Subcutaneous",
    doses: ["per sliding scale on the chart"], frequencies: ["with meals"],
    indications: ["Blood sugar control"], rehabRelevant: true,
  },
  {
    drug: "Sodium chloride 0.9%", form: "infusion", route: "Intravenous",
    doses: ["500 mL", "1000 mL"], frequencies: ["over 8 hours", "over 12 hours"],
    indications: ["Hydration"], rehabRelevant: false,
  },
  {
    drug: "Tramadol", form: "capsule", route: "Oral",
    doses: ["50 mg"], frequencies: ["up to 3x daily", "at night"],
    indications: ["Pain"], rehabRelevant: true,
  },
  {
    drug: "Macrogol", form: "sachet", route: "Oral",
    doses: ["1 sachet"], frequencies: ["once daily", "2x daily"],
    indications: ["Constipation"], rehabRelevant: false,
  },
];

/** Admission reasons, as categories. The record never holds a free-text story. */
export const ADMISSION_REASONS = [
  "Planned surgery", "Emergency admission", "Fall", "Infection",
  "Cardiac monitoring", "Respiratory difficulty", "Rehabilitation after surgery",
  "Scheduled day case", "Observation",
];

export const DIAGNOSIS_LABELS = [
  "Hypertension", "Type 2 diabetes", "Atrial fibrillation", "Chronic kidney disease",
  "Osteoarthritis", "Community-acquired pneumonia", "Hip fracture", "Heart failure",
  "Asthma", "Post-operative recovery", "Anaemia", "Urinary tract infection",
];

export const REHAB_DIAGNOSES = ["Osteoarthritis", "Hip fracture", "Post-operative recovery"];

export interface CareTaskTemplate {
  kind: string;
  title: string;
  frequency: string;
  role: "Nurse" | "Care assistant";
  /** Only added when the patient needs that level of help. */
  minAutonomy: "Independent" | "Needs help" | "Fully dependent";
}

export const CARE_TASKS: CareTaskTemplate[] = [
  { kind: "Hygiene", title: "Wash and dress", frequency: "each morning", role: "Care assistant", minAutonomy: "Needs help" },
  { kind: "Hygiene", title: "Mouth care", frequency: "2x daily", role: "Care assistant", minAutonomy: "Fully dependent" },
  { kind: "Mobility", title: "Help to the chair", frequency: "3x daily", role: "Care assistant", minAutonomy: "Needs help" },
  { kind: "Mobility", title: "Change position", frequency: "every 3 hours", role: "Care assistant", minAutonomy: "Fully dependent" },
  { kind: "Nutrition", title: "Help with the meal", frequency: "at each meal", role: "Care assistant", minAutonomy: "Needs help" },
  { kind: "Nutrition", title: "Record what was eaten and drunk", frequency: "at each meal", role: "Care assistant", minAutonomy: "Independent" },
  { kind: "Observation", title: "Vital signs round", frequency: "3x daily", role: "Nurse", minAutonomy: "Independent" },
  { kind: "Observation", title: "Ask about pain", frequency: "each round", role: "Nurse", minAutonomy: "Independent" },
  { kind: "Skin", title: "Check pressure areas", frequency: "2x daily", role: "Nurse", minAutonomy: "Needs help" },
  { kind: "Skin", title: "Dressing change", frequency: "each morning", role: "Nurse", minAutonomy: "Independent" },
];

export const AUTONOMY_RANK: Record<string, number> = {
  Independent: 0,
  "Needs help": 1,
  "Fully dependent": 2,
};

/** Administration outcomes, from a list. No free text at the bedside. */
export const ADMIN_NOTES = [
  "Patient asleep, given later",
  "Patient declined",
  "Held on the prescriber's instruction",
  "Nausea reported",
  "Taken without difficulty",
];

export const REHAB_NOTES = [
  "Walked to the end of the corridor with a frame",
  "Sat out of bed for thirty minutes",
  "Range of movement improving, no pain reported",
  "Tired today, session shortened",
  "Stairs practised with one rail",
  "Breathing exercises completed",
];

export const NURSE_NOTES = [
  "Comfortable, no complaint this shift",
  "Slept well, ate most of the meal",
  "Family visited, questions answered",
  "Wound clean and dry",
  "Asked about going home, referred to the doctor",
];

export const DOC_TYPES = [
  "Admission letter", "Operating note", "Imaging report", "Laboratory results",
  "Rehabilitation referral", "Discharge summary", "Letter to the referring doctor",
];

export const ALLERGIES = ["Penicillin", "Iodine contrast", "Latex", "Sulfonamides", "Aspirin"];

export const MOBILITY = [
  "Walks unaided", "Walks with a stick", "Walks with a frame",
  "Transfers with one person", "Transfers with two people", "Bed-bound",
];

/**
 * Prefix on every identifier that stands in for a national health identifier,
 * so a demo record can never be mistaken for a real one or loaded anywhere
 * expecting a real one.
 */
export const DEMO_INS_PREFIX = "DEMO-NOT-AN-INS-";

import type { Facility } from "./types";

export const FACILITIES: Facility[] = [
  { id: "PAR", name: "St. Gabriel Paris Central", city: "Paris", beds: 640, dir: "Hélène Roussel" },
  { id: "LYO", name: "St. Gabriel Lyon", city: "Lyon", beds: 410, dir: "Marc Villeneuve" },
  { id: "LIL", name: "St. Gabriel Lille", city: "Lille", beds: 295, dir: "Awa Diallo" },
  { id: "NAN", name: "St. Gabriel Nantes", city: "Nantes", beds: 240, dir: "Pierre Lacroix" },
];

export const DEPTS = [
  "Emergency", "ICU", "Surgery", "Radiology", "Maternity", "Pharmacy",
  "Laboratory", "Facilities", "HR", "Finance", "Procurement", "IT",
];

export const FIRST = [
  "Marie","Thomas","Nadia","Lucas","Amina","Julien","Sophie","Karim","Claire","Yann",
  "Fatou","Antoine","Léa","Mehdi","Camille","Hugo","Sarah","Paul","Inès","Olivier",
  "Chloé","Samir","Élodie","Victor","Aïcha","Nicolas","Manon","Idriss","Céline","Rémi",
];

export const LAST = [
  "Dupont","Martin","Mensah","Bernard","Haddad","Moreau","Girard","Benali","Lefevre","Rousseau",
  "Diop","Marchand","Fontaine","Amrani","Perrot","Blanchard","Noiret","Da Silva","Kouassi","Leroy",
  "Vasseur","Traoré","Chevalier","Barbier","Sy","Renard","Colin","Bakri","Prevost","Guillot",
];

export const ROLES: Record<string, string[]> = {
  Emergency: ["Emergency nurse", "ER physician", "Triage nurse", "Care assistant"],
  ICU: ["ICU nurse", "Intensivist", "Respiratory therapist"],
  Surgery: ["Scrub nurse", "Surgeon", "Anaesthetist", "OR coordinator"],
  Radiology: ["Radiographer", "Radiologist", "Imaging technician"],
  Maternity: ["Midwife", "Obstetrician", "Maternity nurse"],
  Pharmacy: ["Hospital pharmacist", "Pharmacy technician"],
  Laboratory: ["Lab technician", "Biologist", "Sample coordinator"],
  Facilities: ["Maintenance technician", "Facilities supervisor", "Cleaner"],
  HR: ["HR officer", "Payroll administrator", "HR business partner"],
  Finance: ["Management controller", "Accountant", "Finance analyst"],
  Procurement: ["Buyer", "Procurement officer", "Contract manager"],
  IT: ["System administrator", "Support technician", "Data protection officer"],
};

export const SUP_A = [
  "BioLab","MediTech","Pharma","SterilCare","NordMed","HospiLog","OxyGen","ScanPlus","CleanMed",
  "Vitalis","Aurora","Delta","Praxis","EuroCare","Lumen","Arkos","Medisys","Nova",
];

export const SUP_B = [
  "Europe","France","Solutions","Group","Santé","Systems","Partners","Industries","Medical","Services",
];

export const CATS = [
  "Medical devices","Pharmaceuticals","Laboratory","Imaging","Consumables",
  "Facility services","Agency staffing","IT & software","Logistics","Catering",
];

export const CONTRACTS = ["CDI", "CDI", "CDI", "CDI", "CDD", "Agency", "Apprentice"] as const;

export const DEPT_WEIGHT: Record<string, number> = {
  Emergency: 1.5, ICU: 1.6, Surgery: 1.8, Radiology: 1.2, Maternity: 1.0, Pharmacy: 1.4,
  Laboratory: 0.9, Facilities: 0.7, HR: 0.4, Finance: 0.35, Procurement: 0.3, IT: 0.55,
};

export const PO_STATUS = [
  "Delivered","Delivered","Delivered","Partially delivered","Open","Open","Awaiting approval","Cancelled",
];

export const PO_ITEMS = [
  "Surgical consumables","IV pumps","Reagent kits","Sterile gowns","Contrast media","Ward beds",
  "Cleaning contract","Agency nursing","Endoscope service","Oxygen supply","Imaging maintenance",
  "Laptops & tablets","Uniform supply","Pharmacy stock",
];

export const EXC = [
  "Price variance vs PO","No matching PO","Quantity mismatch",
  "Duplicate invoice suspected","Missing delivery note","VAT mismatch",
];

/** [name, department, unit value, criticality] */
export const ASSET_TYPES: [string, string, number, "Critical" | "Standard"][] = [
  ["MRI scanner", "Radiology", 1_200_000, "Critical"],
  ["CT scanner", "Radiology", 780_000, "Critical"],
  ["Ultrasound unit", "Maternity", 68_000, "Standard"],
  ["Anaesthesia machine", "Surgery", 92_000, "Critical"],
  ["Infusion pump", "ICU", 3_400, "Standard"],
  ["Patient monitor", "ICU", 12_500, "Critical"],
  ["Ventilator", "ICU", 26_000, "Critical"],
  ["Autoclave", "Surgery", 41_000, "Standard"],
  ["Lab analyser", "Laboratory", 155_000, "Standard"],
  ["Hospital bed", "Emergency", 4_200, "Standard"],
  ["Defibrillator", "Emergency", 18_000, "Critical"],
  ["Endoscope", "Surgery", 55_000, "Standard"],
  ["Cold storage unit", "Pharmacy", 23_000, "Critical"],
  ["Workstation", "IT", 1_100, "Standard"],
  ["HVAC unit", "Facilities", 86_000, "Standard"],
  ["X-ray unit", "Radiology", 210_000, "Critical"],
];

export const DOC_TYPES = [
  "Invoice","Supplier contract","Employment contract","Professional credential","Insurance certificate",
  "Maintenance report","Safety inspection","Training certificate","Policy","Delivery note",
];

export const DOMAINS = [
  "Patient safety","Fire & building safety","Data protection (GDPR)","Medical device vigilance",
  "Occupational health","Pharmacy & controlled drugs","Infection control","Employment & payroll",
  "Procurement integrity",
];

export const FIND_TXT = [
  "Evidence missing for last review cycle","Corrective action past due",
  "Control owner not reassigned after leaver","Training completion below threshold",
  "Supplier certificate expired","Temperature log gaps recorded",
  "Access review not completed","Incident report closed without root cause",
];

export const AUDIT_NAMES = [
  "Annual fire safety audit","GDPR processing review","Pharmacy controlled drugs audit",
  "Internal financial control audit","Infection control inspection","Medical device traceability audit",
  "Payroll compliance review","Supplier due diligence review","Data retention review",
  "Radiation protection audit","Catering safety audit","Occupational health audit",
];

export const WF_DEFS = [
  { id: "WF-01", name: "New employee onboarding", trigger: "Employee record created", steps: ["Trigger","Collect documents","AI extraction","Manager + HR approval","Create IT and training tasks","Notify payroll","Audit"], owner: "HR" },
  { id: "WF-02", name: "Invoice exception resolution", trigger: "Invoice fails 3-way match", steps: ["Trigger","Match against PO","Flag exception","Buyer review","Finance approval","Post to ledger","Audit"], owner: "Finance" },
  { id: "WF-03", name: "Contract renewal", trigger: "Contract expiry in 60 days", steps: ["Trigger","Notify owner","Prepare renewal","Legal check","Approval","Sign and file","Audit"], owner: "Procurement" },
  { id: "WF-04", name: "Credential expiry", trigger: "Credential expires in 45 days", steps: ["Trigger","Notify employee","Upload new credential","Verify","Update record","Audit"], owner: "HR" },
  { id: "WF-05", name: "Purchase request approval", trigger: "Purchase request submitted", steps: ["Trigger","Budget check","Department approval","Finance approval","Create PO","Audit"], owner: "Procurement" },
  { id: "WF-06", name: "Asset maintenance scheduling", trigger: "Service date reached", steps: ["Trigger","Create work order","Assign technician","Complete service","Upload report","Audit"], owner: "Facilities" },
  { id: "WF-07", name: "Compliance evidence collection", trigger: "Control due", steps: ["Trigger","Request evidence","Upload","Review","Close control","Audit"], owner: "Compliance" },
  { id: "WF-08", name: "Agency shift request", trigger: "Coverage gap detected", steps: ["Trigger","Check internal availability","Approve agency use","Book shift","Confirm cost","Audit"], owner: "Workforce" },
];

export const TASKTXT = [
  "Approve purchase request","Upload missing delivery note","Review expiring credential",
  "Confirm agency shift cost","Validate extracted invoice fields","Close corrective action",
  "Sign contract renewal","Assign maintenance technician",
];

export const SHIFTS = ["Morning", "Afternoon", "Night"] as const;

/** [title, area, value, confidence, evidence, action] */
export const OPP: [string, string, number, string, string, string][] = [
  ["Duplicate supplier spend across facilities","Procurement",118000,"High","Three facilities buy the same sterile consumables from two suppliers at different prices. Consolidating on the lower unit price closes the gap.","Consolidate sterile consumables onto a single supplier"],
  ["Approval delays create rush orders","Procurement",76000,"High","Purchase requests above €10k wait an average of 6.4 days, which pushes 14% of orders into express delivery pricing.","Add automatic budget check to skip one approval level"],
  ["Unmatched invoices held in exception","Finance",64000,"Medium","23 invoices sit in exception with no linked PO. Late payment interest and lost discounts accumulate monthly.","Route unmatched invoices to buyers within 24 hours"],
  ["Under-used imaging capacity","Radiology",54000,"Medium","74 assets run below 35% utilisation while agency imaging is booked externally.","Reschedule external imaging onto internal capacity"],
  ["Agency nursing above plan in ICU","Workforce",212000,"High","Agency FTE covers 9.1% of ICU hours against a 5% plan, mainly on night shifts.","Open 6 internal night posts and reduce agency bookings"],
  ["Maintenance contracts overlap warranty","Assets",38000,"Low","41 assets are covered by a paid service contract while still under manufacturer warranty.","Suspend paid contracts until warranty expiry"],
  ["Pharmacy stock write-offs","Pharmacy",47000,"Medium","Short-dated stock is written off at four sites without inter-site transfer.","Enable inter-site stock transfer before expiry"],
  ["Overtime concentrated in Emergency","Workforce",93000,"Medium","Overtime hours cluster on weekends in Emergency at two facilities.","Rebalance weekend rota and cap consecutive shifts"],
];

export const EV_ACT = [
  "Invoice approved","Purchase order created","Employee record updated","Document uploaded",
  "Workflow executed","Role permission changed","Budget revised","Login via SSO","Export generated",
  "MFA challenge passed","Asset service completed","Corrective action closed","Supplier created",
  "Contract renewed","Failed login attempt",
];

export const ACTORS = [
  "C. Laurent","HR team","Finance controller","Procurement officer","System (workflow)",
  "AI Copilot","Facilities supervisor","IT administrator",
];

export const CLINICAL = ["Emergency","ICU","Surgery","Radiology","Maternity","Pharmacy","Laboratory"];

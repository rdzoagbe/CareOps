/**
 * Builds the synthetic CareOps dataset.
 *
 * This is a line-by-line port of the prototype's generator. Every value comes
 * from one seeded LCG, so the ORDER of `rng` calls below is part of the data
 * contract: reordering them silently changes every headline figure. Where the
 * prototype relied on JavaScript short-circuit evaluation (a `chance()` that
 * only runs in one branch of a ternary), that laziness is preserved here.
 *
 * No patient data. Employee data is the minimum a back-office needs.
 */
import { Lcg, SEED } from "./random";
import { dayAdd, iso, mkey, MONTH_KEYS } from "./dates";
import { pad } from "./format";
import {
  ACTORS, ASSET_TYPES, AUDIT_NAMES, CATS, CLINICAL, CONTRACTS, DEPTS, DEPT_WEIGHT,
  DOC_TYPES, DOMAINS, EV_ACT, EXC, FACILITIES, FIND_TXT, FIRST, LAST, OPP, PO_ITEMS,
  PO_STATUS, ROLES, SHIFTS, SUP_A, SUP_B, TASKTXT, WF_DEFS,
} from "./constants";
import type {
  Asset, Audit, AuditEvent, Budget, ContractType, Control, Coverage, Dataset,
  DocumentLink, DocumentRecord, Employee, Finding, Integration, Invoice, Notification,
  Opportunity, PurchaseOrder, Report, Supplier, Task, Workflow, WorkflowRun,
} from "./types";

export function buildDataset(seed: number = SEED): Dataset {
  const rng = new Lcg(seed);

  const budgets: Budget[] = [];
  const employees: Employee[] = [];
  const suppliers: Supplier[] = [];
  const pos: PurchaseOrder[] = [];
  const invoices: Invoice[] = [];
  const assets: Asset[] = [];
  const documents: DocumentRecord[] = [];
  const controls: Control[] = [];
  const findings: Finding[] = [];
  const audits: Audit[] = [];
  const workflows: Workflow[] = [];
  const runs: WorkflowRun[] = [];
  const tasks: Task[] = [];
  const coverage: Coverage[] = [];
  const opportunities: Opportunity[] = [];
  const events: AuditEvent[] = [];

  /* ---- budgets: per facility x department, 12 months of actuals ---- */
  for (const f of FACILITIES) {
    const scale = f.beds / 640;
    for (const d of DEPTS) {
      const annual = Math.round((1_685_000 * DEPT_WEIGHT[d] * scale) / 1000) * 1000;
      const stress =
        d === "Pharmacy" ? 1.14
        : d === "Radiology" ? 1.08
        : d === "Emergency" ? 1.05
        : d === "Facilities" ? 0.93
        : 0.97 + rng.next() * 0.08;
      const monthly = MONTH_KEYS.map((_k, i) => {
        const season = 1 + (i >= 3 && i <= 5 ? 0.07 : i >= 9 ? 0.05 : -0.02);
        return Math.round((annual / 12) * stress * season * (0.94 + rng.next() * 0.12));
      });
      budgets.push({
        id: `BUD-${f.id}-${d.slice(0, 3).toUpperCase()}`,
        facility: f.id,
        dept: d,
        annual,
        monthly,
        actual: monthly.reduce((a, b) => a + b, 0),
        owner: d + " manager",
        fy: "FY2026",
      });
    }
  }

  /* ---- employees ---- */
  for (let i = 1; i <= 1284; i++) {
    const f = rng.chance(0.46) ? FACILITIES[0]
      : rng.chance(0.5) ? FACILITIES[1]
      : rng.chance(0.6) ? FACILITIES[2]
      : FACILITIES[3];
    const dept = rng.pick(DEPTS);
    const ctype = rng.pick(CONTRACTS) as ContractType;
    const start = dayAdd(-rng.int(60, 4200));
    const contractEnd = ctype === "CDI" ? null : iso(dayAdd(rng.int(-20, 420)));
    const credEnd = CLINICAL.includes(dept) ? iso(dayAdd(rng.int(-30, 900))) : null;

    const name = rng.pick(FIRST) + " " + rng.pick(LAST);
    const role = rng.pick(ROLES[dept]);
    const credential = credEnd
      ? rng.pick(["RN licence", "Medical registration", "Radiation safety", "Pharmacist licence", "Lab certification"])
      : null;
    const fte = rng.chance(0.82) ? 1 : rng.chance(0.6) ? 0.8 : 0.5;
    const salary = Math.round((32000 + rng.int(0, 58000)) / 100) * 100;
    const training = rng.chance(0.19) ? "Overdue" : rng.chance(0.15) ? "Due soon" : "Up to date";
    const status = rng.chance(0.03) ? "On leave" : "Active";
    const manager = rng.pick(FIRST) + " " + rng.pick(LAST);
    const onboarding = rng.chance(0.05) ? "In progress" : "Complete";

    employees.push({
      id: "EMP-" + pad(i), name, dept, facility: f.id, role,
      contract: ctype, start: iso(start), contractEnd, credential, credentialEnd: credEnd,
      fte, salary, training: training as Employee["training"], status: status as Employee["status"],
      manager, email: "", onboarding: onboarding as Employee["onboarding"],
    });
  }
  for (const e of employees) {
    e.email =
      e.name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").replace(" ", ".") +
      "@st-gabriel.demo";
  }

  /* ---- suppliers ---- */
  for (let i = 1; i <= 187; i++) {
    const name = rng.pick(SUP_A) + " " + rng.pick(SUP_B);
    const category = rng.pick(CATS);
    const risk = rng.chance(0.08) ? "High" : rng.chance(0.24) ? "Medium" : "Low";
    const onTime = rng.int(72, 99);
    const quality = rng.int(74, 99);
    const contractEnd = iso(dayAdd(rng.int(-40, 900)));
    suppliers.push({
      id: "SUP-" + pad(i, 3),
      name: name + (i > 60 ? " " + i : ""),
      category,
      risk: risk as Supplier["risk"],
      onTime, quality, contractEnd,
      contact: "contact@" + name.toLowerCase().replace(/[^a-z]/g, "") + ".demo",
      spend: 0, poCount: 0, invCount: 0, disputes: 0,
    });
  }

  /* ---- purchase orders ---- */
  for (let i = 1; i <= 246; i++) {
    const s = rng.pick(suppliers);
    const f = rng.pick(FACILITIES);
    const d = rng.pick(DEPTS);
    const created = dayAdd(-rng.int(5, 350));
    const amount = Math.round((1200 + rng.next() * rng.next() * 260000) / 10) * 10;
    const expected = iso(new Date(created.getTime() + rng.int(5, 60) * 86400000));
    const status = rng.pick(PO_STATUS);
    const item = rng.pick(PO_ITEMS);
    const requester = rng.pick(employees).id;
    const approver = rng.chance(0.5) ? "Finance controller" : "Department head";
    pos.push({
      id: "PO-" + (2000 + i), supplier: s.id, facility: f.id, dept: d, amount,
      created: iso(created), expected, status, item, requester, approver,
    });
  }

  /* ---- invoices ---- */
  for (let i = 1; i <= 428; i++) {
    const po = rng.chance(0.87) ? rng.pick(pos) : null;
    const s = po ? suppliers.find((x) => x.id === po.supplier)! : rng.pick(suppliers);
    const d = dayAdd(-rng.int(1, 350));
    const base = po ? po.amount : Math.round((800 + rng.next() * rng.next() * 90000) / 10) * 10;
    const variance = rng.chance(0.12) ? Math.round(base * (0.03 + rng.next() * 0.12)) : 0;
    const exception = variance
      ? rng.pick([EXC[0], EXC[2], EXC[5]])
      : !po && rng.chance(0.55)
        ? EXC[1]
        : rng.chance(0.04)
          ? rng.pick([EXC[3], EXC[4]])
          : null;
    const facility = po ? po.facility : rng.pick(FACILITIES).id;
    const dept = po ? po.dept : rng.pick(DEPTS);
    const due = iso(new Date(d.getTime() + rng.int(20, 60) * 86400000));
    const status = exception
      ? "Exception"
      : rng.chance(0.62) ? "Paid" : rng.chance(0.5) ? "Approved" : "Pending approval";
    invoices.push({
      id: "INV-2026-" + pad(i), supplier: s.id, po: po ? po.id : null, facility, dept,
      amount: base + variance, poAmount: po ? po.amount : null, variance,
      date: iso(d), month: mkey(d), due, status, exception, matched: !exception,
    });
  }
  for (const v of invoices) {
    const s = suppliers.find((x) => x.id === v.supplier)!;
    s.spend += v.amount;
    s.invCount++;
    if (v.exception) s.disputes++;
  }
  for (const p of pos) suppliers.find((x) => x.id === p.supplier)!.poCount++;

  /* ---- assets ---- */
  for (let i = 1; i <= 1840; i++) {
    const t = rng.pick(ASSET_TYPES);
    const f = rng.pick(FACILITIES);
    const bought = dayAdd(-rng.int(120, 3600));
    const util = rng.int(12, 99);
    const warranty = iso(dayAdd(rng.int(-400, 1200)));
    const nextService = iso(dayAdd(rng.int(-25, 330)));
    const maintenanceYtd = Math.round(t[2] * (0.01 + rng.next() * 0.06));
    const status = rng.chance(0.02) ? "Out of service" : rng.chance(0.05) ? "In maintenance" : "Operational";
    const supplier = rng.pick(suppliers).id;
    assets.push({
      id: "AST-" + pad(i), name: t[0] + " " + pad(i, 4), type: t[0], dept: t[1], facility: f.id,
      value: t[2], criticality: t[3], purchased: iso(bought), warranty, nextService,
      maintenanceYtd, utilisation: util, status, supplier,
    });
  }

  /* ---- documents ---- */
  for (let i = 1; i <= 965; i++) {
    const type = rng.pick(DOC_TYPES);
    let link: DocumentLink | null = null;
    let linkLabel = "";
    if (type === "Invoice") {
      const v = rng.pick(invoices);
      link = { k: "invoice", id: v.id };
      linkLabel = v.id;
    } else if (type === "Employment contract" || type === "Professional credential" || type === "Training certificate") {
      const e = rng.pick(employees);
      link = { k: "employee", id: e.id };
      linkLabel = e.name;
    } else if (type === "Supplier contract") {
      const s = rng.pick(suppliers);
      link = { k: "supplier", id: s.id };
      linkLabel = s.name;
    } else if (type === "Maintenance report") {
      const a = rng.pick(assets);
      link = { k: "asset", id: a.id };
      linkLabel = a.id;
    }
    const conf = 78 + Math.round(rng.next() * 21);
    const facility = rng.pick(FACILITIES).id;
    const dept = rng.pick(DEPTS);
    const uploaded = iso(dayAdd(-rng.int(1, 700)));
    const expiry = rng.chance(0.42) ? iso(dayAdd(rng.int(-30, 540))) : null;
    const state = conf < 85 ? "Needs review" : rng.chance(0.06) ? "Missing metadata" : "Extracted";
    const owner = rng.pick(["Finance", "HR", "Procurement", "Facilities", "Compliance"]);
    const size = rng.int(120, 4800) + " KB";
    documents.push({
      id: "DOC-" + pad(i), type, facility, dept, uploaded, expiry, confidence: conf,
      state: state as DocumentRecord["state"], link, linkLabel, owner,
      file: type.toLowerCase().replace(/ /g, "_") + "_" + pad(i) + ".pdf", size,
    });
  }

  /* ---- compliance ---- */
  let cid = 1;
  for (const dom of DOMAINS) {
    const n = rng.int(9, 16);
    for (let i = 0; i < n; i++) {
      const ok = rng.chance(0.87);
      const facility = rng.pick(FACILITIES).id;
      const frequency = rng.pick(["Monthly", "Quarterly", "Annual", "Continuous"]);
      const owner = rng.pick(["Compliance", "Facilities", "HR", "Pharmacy", "IT", "Quality"]);
      const lastCheck = iso(dayAdd(-rng.int(5, 200)));
      const nextCheck = iso(dayAdd(rng.int(-15, 200)));
      const state = ok ? "Effective" : rng.chance(0.5) ? "Partially effective" : "Not effective";
      const evidenceCount = rng.int(2, 24);
      controls.push({
        id: "CTL-" + pad(cid++, 3), domain: dom, facility, name: dom + " control " + (i + 1),
        frequency, owner, lastCheck, nextCheck, state: state as Control["state"], evidenceCount,
      });
    }
  }
  for (let i = 1; i <= 17; i++) {
    const c = rng.pick(controls);
    const title = rng.pick(FIND_TXT);
    const severity = rng.chance(0.25) ? "High" : rng.chance(0.5) ? "Medium" : "Low";
    const raised = iso(dayAdd(-rng.int(5, 160)));
    const due = iso(dayAdd(rng.int(-25, 90)));
    const owner = rng.pick(["Compliance", "Facilities", "HR", "Pharmacy", "IT"]);
    const status = rng.chance(0.35) ? "In progress" : rng.chance(0.4) ? "Open" : "Awaiting evidence";
    const action = rng.pick([
      "Collect and upload evidence", "Re-run control and document result",
      "Assign new control owner", "Schedule remedial training",
      "Request updated supplier certificate",
    ]);
    findings.push({
      id: "FND-" + pad(i, 3), control: c.id, domain: c.domain, facility: c.facility,
      title, severity: severity as Finding["severity"], raised, due, owner, status, action,
    });
  }
  for (let i = 0; i < 12; i++) {
    const facility = rng.pick(FACILITIES).id;
    const date = iso(dayAdd(rng.int(-120, 150)));
    const lead = rng.pick(["Internal audit", "External auditor", "Regional authority"]);
    const scope = rng.pick(DOMAINS);
    const status = rng.chance(0.35) ? "Completed" : rng.chance(0.5) ? "Scheduled" : "In progress";
    audits.push({
      id: "AUD-" + pad(i + 1, 3), name: AUDIT_NAMES[i], facility, date, lead, scope,
      status, findings: rng.int(0, 4),
    });
  }

  /* ---- workflows + runs + tasks ---- */
  WF_DEFS.forEach((w, i) => {
    workflows.push({
      ...w,
      status: i === 7 ? "Paused" : "Active",
      runs30: rng.int(14, 220),
      successRate: rng.int(88, 100),
      avgMinutes: rng.int(6, 240),
      lastRun: iso(dayAdd(-rng.int(0, 4))),
      stepNow: rng.int(1, w.steps.length - 2),
    });
  });
  for (let i = 1; i <= 140; i++) {
    const w = rng.pick(workflows);
    const started = iso(dayAdd(-rng.int(0, 30)));
    const status = rng.chance(0.83) ? "Completed"
      : rng.chance(0.55) ? "Awaiting approval"
      : rng.chance(0.5) ? "Running" : "Failed";
    const step = rng.pick(w.steps);
    const durationMin = rng.int(2, 320);
    const actor = rng.pick(["System", "HR", "Finance", "Procurement", "Facilities"]);
    runs.push({ id: "RUN-" + (1000 + i), workflow: w.id, started, status, step, durationMin, actor });
  }
  for (let i = 1; i <= 24; i++) {
    const title = rng.pick(TASKTXT);
    const workflow = rng.pick(workflows).id;
    const due = iso(dayAdd(rng.int(-4, 14)));
    const priority = rng.chance(0.25) ? "High" : rng.chance(0.5) ? "Medium" : "Normal";
    const assignee = rng.pick(["You", "Finance team", "HR team", "Procurement", "Facilities"]);
    const facility = rng.pick(FACILITIES).id;
    tasks.push({ id: "TSK-" + pad(i, 3), title, workflow, due, priority, assignee, status: "Open", facility });
  }

  /* ---- workforce coverage ---- */
  for (const f of FACILITIES) {
    for (const d of DEPTS.slice(0, 7)) {
      for (const sh of SHIFTS) {
        const required = rng.int(6, 34);
        const scheduled = Math.max(2, required - (rng.chance(0.4) ? rng.int(0, 5) : 0));
        const agency = rng.chance(0.5) ? rng.int(0, 4) : 0;
        const absence = rng.chance(0.3) ? rng.int(1, 3) : 0;
        const overtimeHrs = rng.int(0, 120);
        coverage.push({ facility: f.id, dept: d, shift: sh, required, scheduled, agency, absence, overtimeHrs });
      }
    }
  }

  /* ---- waste / intelligence opportunities ---- */
  OPP.forEach((o, i) => {
    opportunities.push({
      id: "OPP-" + pad(i + 1, 3), title: o[0], area: o[1], value: o[2], confidence: o[3],
      evidence: o[4], action: o[5], facility: rng.pick(FACILITIES).id, owner: o[1],
      status: i < 2 ? "In review" : "Identified",
    });
  });

  /* ---- audit events ---- */
  for (let i = 1; i <= 2841; i++) {
    const d = dayAdd(-rng.int(0, 120));
    const time = pad(rng.int(6, 21), 2) + ":" + pad(rng.int(0, 59), 2);
    const actor = rng.pick(ACTORS);
    const action = rng.pick(EV_ACT);
    const facility = rng.pick(FACILITIES).id;
    const object = rng.pick([
      rng.pick(invoices).id, rng.pick(pos).id, rng.pick(employees).id,
      rng.pick(assets).id, rng.pick(documents).id,
    ]);
    const result = rng.chance(0.97) ? "Success" : "Blocked by policy";
    events.push({
      id: "EVT-" + pad(i, 5), at: iso(d), time, actor, action, facility, object,
      result: result as AuditEvent["result"],
    });
  }
  events.sort((a, b) => (b.at + b.time).localeCompare(a.at + a.time));

  const integrations: Integration[] = [
    { id: "INT-01", name: "HRIS", system: "Workday-style HRIS", protocol: "REST API", status: "Connected", lastSync: "12 min ago", records: "1,284 employees", dir: "Inbound" },
    { id: "INT-02", name: "Payroll", system: "National payroll provider", protocol: "SFTP", status: "Connected", lastSync: "Today 04:10", records: "Monthly payroll file", dir: "Outbound" },
    { id: "INT-03", name: "ERP / Finance", system: "SAP-style ERP", protocol: "REST API", status: "Connected", lastSync: "38 min ago", records: "428 invoices · 246 POs", dir: "Bidirectional" },
    { id: "INT-04", name: "Procurement portal", system: "Supplier portal", protocol: "Webhook", status: "Degraded", lastSync: "6 h ago", records: "187 suppliers", dir: "Inbound" },
    { id: "INT-05", name: "HIS / DPI", system: "Hospital information system", protocol: "FHIR (non-clinical scope)", status: "Connected", lastSync: "1 h ago", records: "Bed and activity counts only", dir: "Inbound" },
    { id: "INT-06", name: "Identity provider", system: "Entra ID", protocol: "SAML / OIDC", status: "Connected", lastSync: "Live", records: "1,214 SSO users", dir: "Bidirectional" },
    { id: "INT-07", name: "Biomedical CMMS", system: "Maintenance management", protocol: "REST API", status: "Not connected", lastSync: "—", records: "1,840 assets", dir: "Bidirectional" },
  ];

  const reports: Report[] = [
    { id: "RPT-01", name: "Executive board pack", period: "Q3 2026", owner: "Group operations", pages: 24, updated: iso(dayAdd(-3)) },
    { id: "RPT-02", name: "Monthly management review", period: "September 2026", owner: "Finance", pages: 12, updated: iso(dayAdd(-1)) },
    { id: "RPT-03", name: "Budget variance by department", period: "FY2026 YTD", owner: "Finance", pages: 8, updated: iso(dayAdd(-2)) },
    { id: "RPT-04", name: "Workforce and agency spend", period: "September 2026", owner: "HR", pages: 9, updated: iso(dayAdd(-5)) },
    { id: "RPT-05", name: "Compliance status report", period: "Q3 2026", owner: "Compliance", pages: 15, updated: iso(dayAdd(-6)) },
    { id: "RPT-06", name: "Supplier performance and risk", period: "FY2026 YTD", owner: "Procurement", pages: 11, updated: iso(dayAdd(-8)) },
  ];

  const notifications: Notification[] = [
    { t: "3 contracts expire within 30 days", k: "hr", tone: "warn" },
    { t: "Invoice exceptions above threshold in Pharmacy", k: "procurement", tone: "bad" },
    { t: "Fire safety evidence due this week", k: "compliance", tone: "warn" },
    { t: "Agency spend in ICU above plan", k: "workforce", tone: "bad" },
    { t: "Supplier portal sync degraded", k: "integrations", tone: "warn" },
  ];

  return {
    facilities: FACILITIES, depts: DEPTS, employees, suppliers, pos, invoices, assets,
    documents, budgets, controls, findings, audits, workflows, runs, tasks, coverage,
    opportunities, events, integrations, reports, notifications,
  };
}

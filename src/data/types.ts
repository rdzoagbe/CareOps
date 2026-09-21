/** Domain types for the CareOps synthetic dataset. No patient data exists here. */

export interface Facility {
  id: string;
  name: string;
  city: string;
  beds: number;
  dir: string;
}

export type ContractType = "CDI" | "CDD" | "Agency" | "Apprentice";

export interface Employee {
  id: string;
  name: string;
  dept: string;
  facility: string;
  role: string;
  contract: ContractType;
  start: string;
  contractEnd: string | null;
  credential: string | null;
  credentialEnd: string | null;
  fte: number;
  salary: number;
  training: "Overdue" | "Due soon" | "Up to date";
  status: "Active" | "On leave";
  manager: string;
  email: string;
  onboarding: "Complete" | "In progress";
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  risk: "Low" | "Medium" | "High";
  onTime: number;
  quality: number;
  contractEnd: string;
  contact: string;
  spend: number;
  poCount: number;
  invCount: number;
  disputes: number;
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  facility: string;
  dept: string;
  amount: number;
  created: string;
  expected: string;
  status: string;
  item: string;
  requester: string;
  approver: string;
}

export interface Invoice {
  id: string;
  supplier: string;
  po: string | null;
  facility: string;
  dept: string;
  amount: number;
  poAmount: number | null;
  variance: number;
  date: string;
  month: string;
  due: string;
  status: string;
  exception: string | null;
  matched: boolean;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  dept: string;
  facility: string;
  value: number;
  criticality: "Critical" | "Standard";
  purchased: string;
  warranty: string;
  nextService: string;
  maintenanceYtd: number;
  utilisation: number;
  status: string;
  supplier: string;
}

export interface DocumentLink {
  k: "invoice" | "employee" | "supplier" | "asset";
  id: string;
}

export interface DocumentRecord {
  id: string;
  type: string;
  facility: string;
  dept: string;
  uploaded: string;
  expiry: string | null;
  confidence: number;
  state: "Extracted" | "Needs review" | "Missing metadata";
  link: DocumentLink | null;
  linkLabel: string;
  owner: string;
  file: string;
  size: string;
}

export interface Budget {
  id: string;
  facility: string;
  dept: string;
  annual: number;
  monthly: number[];
  actual: number;
  owner: string;
  fy: string;
}

export interface Control {
  id: string;
  domain: string;
  facility: string;
  name: string;
  frequency: string;
  owner: string;
  lastCheck: string;
  nextCheck: string;
  state: "Effective" | "Partially effective" | "Not effective";
  evidenceCount: number;
}

export interface Finding {
  id: string;
  control: string;
  domain: string;
  facility: string;
  title: string;
  severity: "Low" | "Medium" | "High";
  raised: string;
  due: string;
  owner: string;
  status: string;
  action: string;
}

export interface Audit {
  id: string;
  name: string;
  facility: string;
  date: string;
  lead: string;
  scope: string;
  status: string;
  findings: number;
}

export interface Workflow {
  id: string;
  name: string;
  trigger: string;
  steps: string[];
  owner: string;
  status: "Active" | "Paused";
  runs30: number;
  successRate: number;
  avgMinutes: number;
  lastRun: string;
  stepNow: number;
}

export interface WorkflowRun {
  id: string;
  workflow: string;
  started: string;
  status: string;
  step: string;
  durationMin: number;
  actor: string;
}

export interface Task {
  id: string;
  title: string;
  workflow: string;
  due: string;
  priority: string;
  assignee: string;
  status: string;
  facility: string;
}

export interface Coverage {
  facility: string;
  dept: string;
  shift: "Morning" | "Afternoon" | "Night";
  required: number;
  scheduled: number;
  agency: number;
  absence: number;
  overtimeHrs: number;
}

export interface Opportunity {
  id: string;
  title: string;
  area: string;
  value: number;
  confidence: string;
  evidence: string;
  action: string;
  facility: string;
  owner: string;
  status: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  time: string;
  actor: string;
  action: string;
  facility: string;
  object: string;
  result: "Success" | "Blocked by policy";
}

export interface Integration {
  id: string;
  name: string;
  system: string;
  protocol: string;
  status: string;
  lastSync: string;
  records: string;
  dir: string;
}

export interface Report {
  id: string;
  name: string;
  period: string;
  owner: string;
  pages: number;
  updated: string;
}

export interface Notification {
  t: string;
  k: string;
  tone: "ok" | "info" | "warn" | "bad";
}

export interface Dataset {
  facilities: Facility[];
  depts: string[];
  employees: Employee[];
  suppliers: Supplier[];
  pos: PurchaseOrder[];
  invoices: Invoice[];
  assets: Asset[];
  documents: DocumentRecord[];
  budgets: Budget[];
  controls: Control[];
  findings: Finding[];
  audits: Audit[];
  workflows: Workflow[];
  runs: WorkflowRun[];
  tasks: Task[];
  coverage: Coverage[];
  opportunities: Opportunity[];
  events: AuditEvent[];
  integrations: Integration[];
  reports: Report[];
  notifications: Notification[];
}

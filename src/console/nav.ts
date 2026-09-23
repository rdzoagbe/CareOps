/**
 * The console's modules: the prototype's seventeen, in its order, plus Service
 * ordering, which is new in the React build. `ported` marks the ones that exist
 * in React; the rest are still served from the prototype at /prototype while
 * they are ported one by one (see docs/ROADMAP.md).
 */
export interface NavItem {
  key: string;
  label: string;
  icon: string;
  ported: boolean;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    section: "Operate",
    items: [
      { key: "dashboard", label: "Command Center", icon: "◧", ported: false },
      { key: "hr", label: "People & HR", icon: "◔", ported: false },
      { key: "portal", label: "Employee Portal", icon: "☺", ported: true },
      { key: "renewals", label: "Renewals & expiries", icon: "⏲", ported: true },
      { key: "finance", label: "Finance & Budgets", icon: "€", ported: false },
      { key: "procurement", label: "Procurement", icon: "⇄", ported: false },
      { key: "orders", label: "Service ordering", icon: "▥", ported: true },
      { key: "workforce", label: "Workforce Planning", icon: "☷", ported: false },
      { key: "assets", label: "Assets & Equipment", icon: "▤", ported: false },
    ],
  },
  {
    section: "Automate",
    items: [
      { key: "documents", label: "Document Intelligence", icon: "▦", ported: false },
      { key: "workflows", label: "Workflow Automation", icon: "⚙", ported: false },
      { key: "compliance", label: "Compliance", icon: "✓", ported: false },
    ],
  },
  {
    section: "Decide",
    items: [
      { key: "intelligence", label: "Intelligence Hub", icon: "◇", ported: false },
      { key: "reports", label: "Reports", icon: "▣", ported: false },
      { key: "copilot", label: "AI Copilot", icon: "✦", ported: false },
    ],
  },
  {
    section: "Administer",
    items: [
      { key: "access", label: "People & access", icon: "⚿", ported: true },
      { key: "organization", label: "Organization", icon: "⌂", ported: false },
      { key: "integrations", label: "Integration Hub", icon: "⇋", ported: false },
      { key: "security", label: "Security & Audit", icon: "⛨", ported: true },
    ],
  },
];

export const ALL_MODULES = NAV.flatMap((s) => s.items);

export const moduleByKey = (key: string): NavItem | undefined =>
  ALL_MODULES.find((m) => m.key === key);

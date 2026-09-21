/**
 * Facility and period filtering, plus the derived figures the console shows.
 * Pure functions over a snapshot, so they can be unit tested without a DOM.
 */
import { MONTH_KEYS } from "./dates";
import type { Budget, Dataset, Facility } from "./types";

export const ALL_FACILITIES = "ALL";

export type PeriodKey = "ytd" | "q3" | "sep" | "r12";

export const PERIODS: Record<PeriodKey, { label: string; months: readonly string[] }> = {
  ytd: { label: "FY2026 year to date", months: MONTH_KEYS.slice(3) },
  q3: { label: "Q3 2026", months: ["2026-07", "2026-08", "2026-09"] },
  sep: { label: "September 2026", months: ["2026-09"] },
  r12: { label: "Last 12 months", months: MONTH_KEYS },
};

export interface Scope {
  facility: string;
  period: PeriodKey;
}

export const inFacility = (facility: string) => (r: { facility: string }) =>
  facility === ALL_FACILITIES || r.facility === facility;

export const facilityName = (facilities: Facility[], id: string): string =>
  id === ALL_FACILITIES ? "All facilities" : (facilities.find((f) => f.id === id)?.name ?? id);

const monthOf = (r: Record<string, unknown>): string => {
  const raw = (r.month ?? r.date ?? r.uploaded ?? r.raised ?? r.at ?? "") as string;
  return raw.slice(0, 7);
};

export const inPeriod = (period: PeriodKey) => (r: Record<string, unknown>) =>
  PERIODS[period].months.includes(monthOf(r));

/** Every filtered collection the console reads, for one scope. */
export function scoped(db: Dataset, scope: Scope) {
  const f = inFacility(scope.facility);
  const p = inPeriod(scope.period);
  return {
    employees: db.employees.filter(f),
    invoices: db.invoices.filter((r) => f(r) && p(r as unknown as Record<string, unknown>)),
    invoicesAll: db.invoices.filter(f),
    pos: db.pos.filter(f),
    assets: db.assets.filter(f),
    documents: db.documents.filter(f),
    budgets: db.budgets.filter(f),
    controls: db.controls.filter(f),
    findings: db.findings.filter(f),
    coverage: db.coverage.filter(f),
    events: db.events.filter(f),
    tasks: db.tasks.filter(f),
    audits: db.audits.filter(f),
    opportunities: db.opportunities.filter(f),
  };
}

/**
 * Plan versus actual for the selected period.
 *
 * Plan is a twelfth of the annual budget per month in scope; actual is the sum
 * of the recorded monthly actuals for the same months. Reconciliation test:
 * over all twelve months, actual must equal the stored `actual` total.
 */
export function periodBudget(budgets: Budget[], period: PeriodKey): { plan: number; actual: number; variance: number } {
  const months = PERIODS[period].months;
  let plan = 0;
  let actual = 0;
  for (const b of budgets) {
    MONTH_KEYS.forEach((k, i) => {
      if (months.includes(k)) {
        plan += b.annual / 12;
        actual += b.monthly[i];
      }
    });
  }
  return { plan, actual, variance: actual - plan };
}

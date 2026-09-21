/**
 * Date helpers for the demo dataset.
 *
 * The prototype pins "today" to 20 September 2026. Dates are built at UTC
 * midday so that both `iso()` and locale formatting land on the same calendar
 * day in every timezone — the prototype used local midnight, which drifted by
 * a day west of Greenwich.
 */
export const TODAY = new Date(Date.UTC(2026, 8, 20, 12, 0, 0));

export const dayAdd = (n: number): Date => {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

export const iso = (d: Date): string => d.toISOString().slice(0, 10);

/** Year-month key, e.g. "2026-09". */
export const mkey = (d: Date): string => d.toISOString().slice(0, 7);

/** Whole days from today to the given ISO date. Negative means overdue. */
export const daysTo = (isoDate: string): number =>
  Math.round((new Date(isoDate + "T12:00:00Z").getTime() - TODAY.getTime()) / 86400000);

/** "20 Sep 2026" */
export const dstr = (d: Date): string =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/** "Mon 21 Sep" */
export const dsh = (s: string): string =>
  new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** "21 September 2026" */
export const dlg = (s: string): string =>
  new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export const MONTHS = [
  "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26",
  "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26",
] as const;

export const MONTH_KEYS = [
  "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
  "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
] as const;

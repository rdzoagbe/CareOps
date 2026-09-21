/** Presentation helpers shared by the console and the employee app. */

export const fmtEUR = (n: number): string =>
  "€" +
  (Math.abs(n) >= 1e6
    ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + "M"
    : Math.abs(n) >= 1e3
      ? Math.round(n / 1e3).toLocaleString("en-GB") + "k"
      : Math.round(n).toLocaleString("en-GB"));

export const fmtEUR0 = (n: number): string => "€" + Math.round(n).toLocaleString("en-GB");

export const pad = (n: number | string, l = 4): string => String(n).padStart(l, "0");

export const num = (n: number): string => n.toLocaleString("en-GB");

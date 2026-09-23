/**
 * Service ordering: one ledger of what each service ordered, and the monitor
 * that flags a service ordering an item far more than it usually does.
 *
 * Two things matter about the shape of this file.
 *
 * 1. It never touches `buildDataset`. The main generator's `rng` call order is
 *    a data contract (see seed.ts), so this layer is built on top of the
 *    finished dataset with its own seeded generator, exactly as `buildRenewals`
 *    is. Every purchase order in `db.pos` appears here once, unchanged, and
 *    `ordersReconcile()` proves the euro totals still match.
 *
 * 2. The monitor proposes, it never acts. It raises an alert on a *service and
 *    an item* — never on a named person — and it cannot cancel, block or
 *    change an order. There is no code path from an alert to the ledger. A
 *    human closes an alert by choosing a reason from a fixed library, the same
 *    shape as the contract guardrail: the system may select, never author.
 */
import { Lcg } from "./random";
import { dayAdd, daysTo, iso, TODAY } from "./dates";
import { pad } from "./format";
import { DEPT_WEIGHT, FACILITIES } from "./constants";
import type { Dataset, Facility, PurchaseOrder } from "./types";

/* ------------------------------------------------------------------ *
 * The ledger
 * ------------------------------------------------------------------ */

/** Anything at or above this goes through a purchase order. Below it, a service requisitions directly. */
export const PO_THRESHOLD = 1200;

export type OrderChannel = "Purchase order" | "Direct requisition";

export interface ServiceOrder {
  id: string;
  /** The hospital service that ordered, e.g. "Emergency". Alerts are raised on this, never on a person. */
  service: string;
  facility: string;
  item: string;
  category: string;
  qty: number;
  unit: string;
  /**
   * Catalogue price per unit. For a direct requisition the amount is qty x this
   * price exactly. For a purchase order the amount is the contracted total, so
   * the quantity is what that total buys at catalogue price, to the nearest unit.
   */
  unitPrice: number;
  amount: number;
  supplier: string;
  /** Kept for the audit trail only. The monitor never reads it and the console never shows it. */
  requester: string;
  placed: string;
  channel: OrderChannel;
  po: string | null;
  status: string;
}

export interface CatalogueLine {
  item: string;
  category: string;
  unit: string;
  /** Catalogue price per unit, in euros. */
  unitPrice: number;
  /** The services that order this item at all. */
  services: string[];
  /** Typical direct requisitions per service per week, before facility size and service weight. */
  weekly: number;
  /** Capital and contracted items never arrive as a direct requisition. */
  capital?: boolean;
}

const WARDS = ["Emergency", "ICU", "Surgery", "Maternity", "Radiology"];

export const CATALOGUE: CatalogueLine[] = [
  { item: "Surgical consumables", category: "Consumables", unit: "box", unitPrice: 42, weekly: 1.1, services: ["Surgery", "Emergency", "ICU", "Maternity"] },
  { item: "Sterile gowns", category: "Consumables", unit: "pack of 25", unitPrice: 58, weekly: 1.4, services: WARDS },
  { item: "Oxygen supply", category: "Consumables", unit: "cylinder", unitPrice: 96, weekly: 0.7, services: ["Emergency", "ICU", "Surgery", "Maternity"] },
  { item: "Uniform supply", category: "Consumables", unit: "set", unitPrice: 64, weekly: 0.45, services: [...WARDS, "Pharmacy", "Laboratory", "Facilities"] },
  { item: "Reagent kits", category: "Laboratory", unit: "kit", unitPrice: 168, weekly: 0.9, services: ["Laboratory", "Pharmacy"] },
  { item: "Contrast media", category: "Imaging", unit: "vial", unitPrice: 74, weekly: 1.5, services: ["Radiology"] },
  { item: "Pharmacy stock", category: "Pharmaceuticals", unit: "order line", unitPrice: 210, weekly: 1.6, services: ["Pharmacy", "ICU", "Emergency", "Surgery"] },
  { item: "Agency nursing", category: "Agency staffing", unit: "shift", unitPrice: 420, weekly: 0.8, services: ["Emergency", "ICU", "Surgery", "Maternity"] },
  { item: "Laptops & tablets", category: "IT & software", unit: "unit", unitPrice: 780, weekly: 0.3, services: ["IT", "HR", "Finance", "Procurement"] },
  { item: "IV pumps", category: "Medical devices", unit: "unit", unitPrice: 1850, weekly: 0, services: ["ICU", "Emergency", "Surgery", "Maternity"], capital: true },
  { item: "Ward beds", category: "Medical devices", unit: "bed", unitPrice: 2400, weekly: 0, services: WARDS, capital: true },
  { item: "Endoscope service", category: "Medical devices", unit: "visit", unitPrice: 1450, weekly: 0, services: ["Surgery"], capital: true },
  { item: "Imaging maintenance", category: "Imaging", unit: "visit", unitPrice: 2100, weekly: 0, services: ["Radiology"], capital: true },
  { item: "Cleaning contract", category: "Facility services", unit: "month", unitPrice: 8600, weekly: 0, services: ["Facilities"], capital: true },
];

const byItem = new Map(CATALOGUE.map((c) => [c.item, c]));

export const catalogueOf = (item: string): CatalogueLine | undefined => byItem.get(item);

/**
 * Raised demand planted into three services, so the monitor always has
 * something real to find in the demo. These are ordinary orders in the ledger;
 * nothing downstream knows they were planted. Same idea as `STORY` in portal.ts.
 */
const SURGES: {
  facility: string;
  service: string;
  item: string;
  /** Extra orders spread over the review window. */
  extra?: number;
  /** A cluster of repeat orders: `n` orders inside `days`, starting `startDay` days ago. */
  burst?: { n: number; days: number; startDay: number };
}[] = [
  { facility: "PAR", service: "Emergency", item: "Sterile gowns", extra: 40 },
  { facility: "LYO", service: "Radiology", item: "Contrast media", burst: { n: 6, days: 4, startDay: 19 } },
  { facility: "LIL", service: "ICU", item: "Agency nursing", extra: 16 },
  { facility: "NAN", service: "Pharmacy", item: "Reagent kits", extra: 11 },
];

const cents = (n: number): number => Math.round(n * 100) / 100;

/** Status for a requisition of a given age, so recent ones are still in flight. */
const statusFor = (ageDays: number, rng: Lcg): string =>
  ageDays > 25 ? (rng.chance(0.96) ? "Delivered" : "Partially delivered")
  : ageDays > 8 ? (rng.chance(0.6) ? "Delivered" : "Open")
  : rng.chance(0.25) ? "Open" : "Awaiting approval";

/**
 * Builds the order ledger: every purchase order as one order line, plus the
 * low-value direct requisitions that never reach the purchase-order threshold.
 * That second stream is where over-ordering actually happens in a hospital.
 */
export function buildServiceOrders(db: Dataset): ServiceOrder[] {
  const rng = new Lcg(770425);
  const out: ServiceOrder[] = [];

  /* ---- every purchase order, one line each, amounts unchanged ---- */
  for (const p of db.pos as PurchaseOrder[]) {
    const c = byItem.get(p.item);
    const unitPrice = c?.unitPrice ?? 100;
    const qty = Math.max(1, Math.round(p.amount / unitPrice));
    out.push({
      id: "ORD-" + pad(out.length + 1, 5),
      service: p.dept,
      facility: p.facility,
      item: p.item,
      category: c?.category ?? "Consumables",
      qty,
      unit: c?.unit ?? "unit",
      unitPrice,
      // The purchase order's own figure, untouched: a negotiated total is not
      // the list price times a quantity, and this ledger must still reconcile
      // with `db.pos` to the cent.
      amount: p.amount,
      supplier: p.supplier,
      requester: p.requester,
      placed: p.created,
      channel: "Purchase order",
      po: p.id,
      status: p.status,
    });
  }

  /* ---- direct requisitions, under the purchase-order threshold ---- */
  const add = (facility: string, service: string, c: CatalogueLine, ageDays: number) => {
    const maxQty = Math.max(1, Math.floor((PO_THRESHOLD - 1) / c.unitPrice));
    const qty = rng.int(1, Math.min(maxQty, 12));
    const requester = db.employees.find((e) => e.facility === facility && e.dept === service);
    out.push({
      id: "ORD-" + pad(out.length + 1, 5),
      service,
      facility,
      item: c.item,
      category: c.category,
      qty,
      unit: c.unit,
      unitPrice: c.unitPrice,
      amount: cents(qty * c.unitPrice),
      supplier: db.suppliers.find((s) => s.category === c.category)?.id ?? db.suppliers[0].id,
      requester: requester?.id ?? "",
      placed: iso(dayAdd(-ageDays)),
      channel: "Direct requisition",
      po: null,
      status: statusFor(ageDays, rng),
    });
  };

  for (const f of FACILITIES) {
    const scale = f.beds / 640;
    for (const c of CATALOGUE) {
      if (c.capital) continue;
      for (const service of c.services) {
        const weight = DEPT_WEIGHT[service] ?? 1;
        const perWeek = c.weekly * scale * (0.55 + weight * 0.5);
        const n = Math.round(perWeek * 52 * (0.85 + rng.next() * 0.3));
        for (let k = 0; k < n; k++) add(f.id, service, c, rng.int(1, 365));

        const surge = SURGES.find((s) => s.facility === f.id && s.service === service && s.item === c.item);
        if (!surge) continue;
        if (surge.extra) {
          for (let k = 0; k < surge.extra; k++) add(f.id, service, c, rng.int(1, WINDOW_DAYS - 2));
        }
        if (surge.burst) {
          const b = surge.burst;
          for (let k = 0; k < b.n; k++) add(f.id, service, c, b.startDay - Math.floor((k * (b.days - 1)) / (b.n - 1)));
        }
      }
    }
  }

  return out.sort((a, b) => (a.placed === b.placed ? a.id.localeCompare(b.id) : b.placed.localeCompare(a.placed)));
}

/**
 * The euro reconciliation between the two ledgers: purchase-order-backed
 * orders must add up to the purchase orders themselves, to the cent.
 */
export function ordersReconcile(orders: ServiceOrder[], pos: PurchaseOrder[]): { orders: number; pos: number; equal: boolean } {
  const a = Math.round(orders.filter((o) => o.channel === "Purchase order").reduce((t, o) => t + o.amount, 0) * 100);
  const b = Math.round(pos.reduce((t, p) => t + p.amount, 0) * 100);
  return { orders: a / 100, pos: b / 100, equal: a === b };
}

/* ------------------------------------------------------------------ *
 * The monitor
 * ------------------------------------------------------------------ */

/** The review window: what the service ordered recently. */
export const WINDOW_DAYS = 90;
/** The comparison window: the nine months before it, rescaled to 90 days. */
export const BASELINE_DAYS = 275;

export type OrderRuleKey = "rate" | "peer" | "burst";

export interface OrderRuleSpec {
  key: OrderRuleKey;
  name: string;
  /** What the rule compares, in one sentence, shown on screen next to every alert. */
  says: string;
  /** Minimum orders in the window before the rule may fire at all. */
  minOrders: number;
  factor?: number;
  days?: number;
  minPeers?: number;
}

/**
 * Three rules, deliberately different in kind: one against the service's own
 * history, one against the same service at the other sites, one against the
 * calendar. A quiet service cannot be flagged by a single order, and a busy
 * one is compared with its own past before anything else.
 */
export const ORDER_RULES: Record<OrderRuleKey, OrderRuleSpec> = {
  rate: {
    key: "rate",
    name: "Above this service's own usual rate",
    says: "Orders in the last 90 days against the same service's rate over the 9 months before that.",
    minOrders: 6,
    factor: 2.5,
  },
  peer: {
    key: "peer",
    name: "Above the same service at the other sites",
    says: "Orders per 100 beds against the median of the same service and item at the other facilities.",
    minOrders: 8,
    factor: 2.5,
    minPeers: 3,
  },
  burst: {
    key: "burst",
    name: "Repeat orders within a few days",
    says:
      "Six or more orders of the same item inside a week, and at least four times as many as this " +
      "service's own pace would put in that many days. That pattern is usually a duplicate requisition.",
    minOrders: 6,
    days: 7,
    factor: 4,
  },
};

export interface OrderRuleHit {
  key: OrderRuleKey;
  /** The measured figure, and what it had to beat. */
  value: number;
  threshold: number;
  detail: string;
}

export type OrderAlertStatus =
  | "Open"
  | "Under review"
  | "Justified"
  | "Action taken"
  | "Muted for 90 days";

export const ORDER_ALERT_TONE: Record<OrderAlertStatus, string> = {
  Open: "bad",
  "Under review": "warn",
  Justified: "ok",
  "Action taken": "ok",
  "Muted for 90 days": "mute",
};

export interface OrderAlert {
  id: string;
  facility: string;
  /** Alerts name a service and an item. They never name a person. */
  service: string;
  item: string;
  category: string;
  severity: "High" | "Medium";
  hits: OrderRuleHit[];
  window: { orders: number; qty: number; spend: number; from: string; to: string };
  baseline: { orders: number; qty: number; spend: number; from: string; to: string };
  /** Window orders divided by the baseline rescaled to the same 90 days. 0 when there is no baseline. */
  ratio: number;
  /** Spend above what the baseline rate would have produced over 90 days. */
  excessSpend: number;
  /** The exact orders counted, so the figure can be checked. */
  orderIds: string[];
  status: OrderAlertStatus;
  reason: string | null;
  owner: string;
  history: [string, string][];
}

/** Reasons a person may record. Chosen from this list, never typed free-hand. */
export const ORDER_JUSTIFICATIONS = [
  "Activity genuinely rose, and the service's activity report shows it",
  "Stock was rebuilt after a shortage",
  "A planned programme or campaign explains the volume",
  "This service ordered on behalf of another under a temporary arrangement",
  "Unit prices changed, volumes did not",
];

export const ORDER_ACTIONS = [
  "Reorder point corrected in the catalogue",
  "Duplicate orders cancelled with the supplier",
  "Orders consolidated into a single delivery",
  "Referred to the procurement committee",
];

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * The tightest cluster of orders in the list, judged against how many the
 * service's own pace would have put in that many days.
 *
 * Counting raw orders is not enough: a ward that orders gowns twice a week has
 * four orders in most weeks, and flagging that is noise. What marks a
 * duplicate is a cluster well above the service's own tempo, so the comparison
 * is `n` against `perDay x span`, and the best cluster is the one furthest
 * above it rather than the biggest.
 */
function tightestCluster(
  placed: string[],
  maxSpanDays: number,
  perDay: number,
): { n: number; span: number; from: string; to: string; ratio: number } {
  const asc = [...placed].sort();
  let best = { n: 0, span: 0, from: "", to: "", ratio: 0 };
  for (let i = 0; i < asc.length; i++) {
    for (let j = i; j < asc.length; j++) {
      const span = daysTo(asc[j]) - daysTo(asc[i]) + 1;
      if (span > maxSpanDays) break;
      const n = j - i + 1;
      const expected = Math.max(perDay * span, 1e-9);
      const ratio = n / expected;
      if (n > best.n || (n === best.n && ratio > best.ratio)) {
        if (ratio > best.ratio || n > best.n) best = { n, span, from: asc[i], to: asc[j], ratio };
      }
    }
  }
  return best;
}

interface Group {
  facility: string;
  service: string;
  item: string;
  category: string;
  win: ServiceOrder[];
  base: ServiceOrder[];
}

const sum = (xs: ServiceOrder[], f: (o: ServiceOrder) => number): number => xs.reduce((t, o) => t + f(o), 0);

/**
 * Runs the three rules over the ledger and returns one alert per service, item
 * and facility that clears a threshold. Pure: same ledger in, same alerts out.
 */
export function buildOrderAlerts(
  orders: ServiceOrder[],
  facilities: Facility[] = FACILITIES,
): OrderAlert[] {
  const winFrom = iso(dayAdd(-WINDOW_DAYS));
  const winTo = iso(TODAY);
  const baseFrom = iso(dayAdd(-(WINDOW_DAYS + BASELINE_DAYS)));
  const baseTo = iso(dayAdd(-(WINDOW_DAYS + 1)));

  const groups = new Map<string, Group>();
  for (const o of orders) {
    // Purchase orders are already approved one by one and matched against their
    // invoice in Procurement. The blind spot is the low-value requisition that
    // nobody signs off individually, so that is what the monitor watches.
    if (o.channel !== "Direct requisition") continue;
    const age = -daysTo(o.placed);
    if (age < 0 || age > WINDOW_DAYS + BASELINE_DAYS) continue;
    const key = `${o.facility}|${o.service}|${o.item}`;
    let g = groups.get(key);
    if (!g) {
      g = { facility: o.facility, service: o.service, item: o.item, category: o.category, win: [], base: [] };
      groups.set(key, g);
    }
    (age <= WINDOW_DAYS ? g.win : g.base).push(o);
  }

  const bedsOf = new Map(facilities.map((f) => [f.id, f.beds]));

  /** Orders per 100 beds in the window, per facility, for each service and item. */
  const peerRates = new Map<string, { facility: string; rate: number }[]>();
  for (const g of groups.values()) {
    const beds = bedsOf.get(g.facility) ?? 1;
    const key = `${g.service}|${g.item}`;
    const list = peerRates.get(key) ?? [];
    list.push({ facility: g.facility, rate: (g.win.length / beds) * 100 });
    peerRates.set(key, list);
  }

  const alerts: OrderAlert[] = [];

  for (const g of groups.values()) {
    const hits: OrderRuleHit[] = [];
    const winOrders = g.win.length;
    const baseline90 = (g.base.length * WINDOW_DAYS) / BASELINE_DAYS;
    const ratio = baseline90 > 0 ? winOrders / baseline90 : 0;

    const rate = ORDER_RULES.rate;
    if (winOrders >= rate.minOrders && baseline90 >= 1 && ratio >= rate.factor!) {
      hits.push({
        key: "rate",
        value: ratio,
        threshold: rate.factor!,
        detail: `${winOrders} orders in 90 days, against ${baseline90.toFixed(1)} for the same service over the 9 months before.`,
      });
    }

    const peer = ORDER_RULES.peer;
    const others = (peerRates.get(`${g.service}|${g.item}`) ?? []).filter((p) => p.facility !== g.facility);
    const peerMedian = median(others.map((p) => p.rate));
    const ownRate = (winOrders / (bedsOf.get(g.facility) ?? 1)) * 100;
    if (
      winOrders >= peer.minOrders &&
      others.length >= peer.minPeers! &&
      peerMedian > 0 &&
      ownRate / peerMedian >= peer.factor!
    ) {
      hits.push({
        key: "peer",
        value: ownRate / peerMedian,
        threshold: peer.factor!,
        detail: `${ownRate.toFixed(1)} orders per 100 beds, against a median of ${peerMedian.toFixed(1)} across ${others.length} other sites.`,
      });
    }

    const burst = ORDER_RULES.burst;
    const cluster = tightestCluster(g.win.map((o) => o.placed), burst.days!, winOrders / WINDOW_DAYS);
    if (cluster.n >= burst.minOrders && cluster.ratio >= burst.factor!) {
      hits.push({
        key: "burst",
        value: cluster.ratio,
        threshold: burst.factor!,
        detail:
          `${cluster.n} separate orders in ${cluster.span} day${cluster.span === 1 ? "" : "s"}, ` +
          `${cluster.from} to ${cluster.to}, where this service's own pace would place ` +
          `${(cluster.ratio ? cluster.n / cluster.ratio : 0).toFixed(1)}.`,
      });
    }

    if (hits.length === 0) continue;

    const winSpend = sum(g.win, (o) => o.amount);
    const baseSpend = sum(g.base, (o) => o.amount);
    const baseSpend90 = (baseSpend * WINDOW_DAYS) / BASELINE_DAYS;

    alerts.push({
      id: "",
      facility: g.facility,
      service: g.service,
      item: g.item,
      category: g.category,
      severity: hits.length >= 2 || ratio >= 4 ? "High" : "Medium",
      hits,
      window: {
        orders: winOrders,
        qty: sum(g.win, (o) => o.qty),
        spend: cents(winSpend),
        from: winFrom,
        to: winTo,
      },
      baseline: {
        orders: g.base.length,
        qty: sum(g.base, (o) => o.qty),
        spend: cents(baseSpend),
        from: baseFrom,
        to: baseTo,
      },
      ratio: cents(ratio),
      excessSpend: baseline90 > 0 ? Math.max(0, Math.round(winSpend - baseSpend90)) : 0,
      orderIds: g.win.map((o) => o.id),
      status: "Open",
      reason: null,
      owner: g.service + " manager",
      history: [["Raised by the ordering monitor", "last night, 02:00"]],
    });
  }

  const rank = { High: 0, Medium: 1 };
  alerts.sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] ||
      b.excessSpend - a.excessSpend ||
      a.facility.localeCompare(b.facility) ||
      a.service.localeCompare(b.service) ||
      a.item.localeCompare(b.item),
  );
  alerts.forEach((a, i) => { a.id = "OA-" + pad(i + 1, 3); });
  return alerts;
}

export const alertOpen = (a: OrderAlert): boolean => a.status === "Open" || a.status === "Under review";

/**
 * The order ledger and the over-ordering monitor.
 *
 * Two things are pinned here beyond the arithmetic: that the ledger still
 * reconciles with the purchase orders it was built from, and that an alert
 * carries no employee identifier. The second is a rule, not a detail — the
 * monitor asks about a service's volume, never about a person.
 */
import { describe, expect, it } from "vitest";
import { buildDataset } from "./seed";
import {
  BASELINE_DAYS, CATALOGUE, ORDER_RULES, PO_THRESHOLD, WINDOW_DAYS,
  buildOrderAlerts, buildServiceOrders, ordersReconcile, type ServiceOrder,
} from "./orders";
import { FACILITIES } from "./constants";
import { dayAdd, daysTo, iso } from "./dates";

const db = buildDataset();
const orders = buildServiceOrders(db);
const alerts = buildOrderAlerts(orders, db.facilities);

const requisitions = orders.filter((o) => o.channel === "Direct requisition");
const poBacked = orders.filter((o) => o.channel === "Purchase order");

describe("the order ledger", () => {
  it("is deterministic", () => {
    const again = buildServiceOrders(buildDataset());
    expect(again.length).toBe(orders.length);
    expect(again.map((o) => o.id + o.amount)).toEqual(orders.map((o) => o.id + o.amount));
  });

  it("carries every purchase order exactly once", () => {
    expect(poBacked).toHaveLength(db.pos.length);
    expect(new Set(poBacked.map((o) => o.po)).size).toBe(db.pos.length);
  });

  it("reconciles with the purchase orders to the cent", () => {
    const r = ordersReconcile(orders, db.pos);
    expect(r.equal).toBe(true);
    expect(r.orders).toBe(r.pos);
  });

  it("prices a direct requisition at quantity times unit price, to the cent", () => {
    for (const o of requisitions) {
      expect(Math.round(o.qty * o.unitPrice * 100)).toBe(Math.round(o.amount * 100));
    }
  });

  it("keeps a purchase order's own total and derives the quantity from it", () => {
    // A negotiated total is not list price times quantity, so the amount is the
    // one the purchase order carries and the quantity is what it buys at
    // catalogue price: within half a unit, by construction.
    for (const o of poBacked) {
      expect(Math.abs(o.qty * o.unitPrice - o.amount)).toBeLessThanOrEqual(o.unitPrice / 2);
    }
  });

  it("keeps direct requisitions under the purchase-order threshold", () => {
    expect(requisitions.length).toBeGreaterThan(1000);
    for (const o of requisitions) expect(o.amount).toBeLessThan(PO_THRESHOLD);
  });

  it("gives every order a real service, facility and catalogue item", () => {
    const facilities = new Set(FACILITIES.map((f) => f.id));
    const items = new Set(CATALOGUE.map((c) => c.item));
    for (const o of orders) {
      expect(db.depts).toContain(o.service);
      expect(facilities.has(o.facility)).toBe(true);
      expect(items.has(o.item)).toBe(true);
      expect(o.qty).toBeGreaterThan(0);
    }
  });

  it("has unique ids and no order dated in the future", () => {
    expect(new Set(orders.map((o) => o.id)).size).toBe(orders.length);
    for (const o of orders) expect(daysTo(o.placed)).toBeLessThanOrEqual(0);
  });

  it("records what was ordered, never why or for whom", () => {
    const keys = new Set(orders.flatMap((o) => Object.keys(o)));
    for (const forbidden of ["patient", "diagnosis", "reason", "indication", "ward", "bed", "case"]) {
      expect([...keys].some((k) => k.toLowerCase().includes(forbidden))).toBe(false);
    }
  });
});

describe("the over-ordering monitor", () => {
  it("is deterministic and pure", () => {
    const again = buildOrderAlerts(orders, db.facilities);
    expect(JSON.stringify(again)).toBe(JSON.stringify(alerts));
  });

  it("raises a handful of alerts, not a wall of them", () => {
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.length).toBeLessThan(15);
  });

  it("never names a person", () => {
    // The requester is on the order record. It must not travel with the alert.
    const blob = JSON.stringify(alerts);
    expect(blob).not.toMatch(/EMP-\d/);
    for (const a of alerts) {
      expect(Object.keys(a)).not.toContain("requester");
      expect(a.owner).toBe(a.service + " manager");
    }
  });

  it("only ever counts direct requisitions", () => {
    // Purchase orders are approved one by one and matched in Procurement, so
    // the monitor stays out of them. It would also skew every count: one
    // 200k order is not one box of gowns.
    const byId = new Map(orders.map((o) => [o.id, o]));
    for (const a of alerts) {
      for (const id of a.orderIds) {
        expect(byId.get(id)!.channel).toBe("Direct requisition");
      }
    }
  });

  it("counts exactly the orders it shows as evidence", () => {
    const byId = new Map(orders.map((o) => [o.id, o]));
    for (const a of alerts) {
      expect(a.orderIds).toHaveLength(a.window.orders);
      const counted = a.orderIds.map((id) => byId.get(id)!);
      expect(counted.reduce((t, o) => t + o.qty, 0)).toBe(a.window.qty);
      expect(Math.round(counted.reduce((t, o) => t + o.amount, 0) * 100) / 100).toBe(a.window.spend);
      for (const o of counted) {
        expect(o.service).toBe(a.service);
        expect(o.item).toBe(a.item);
        expect(o.facility).toBe(a.facility);
        expect(-daysTo(o.placed)).toBeLessThanOrEqual(WINDOW_DAYS);
      }
    }
  });

  it("fires no alert without a rule behind it, and every rule clears its own threshold", () => {
    for (const a of alerts) {
      expect(a.hits.length).toBeGreaterThan(0);
      for (const h of a.hits) {
        expect(h.value).toBeGreaterThanOrEqual(h.threshold);
        expect(h.detail.length).toBeGreaterThan(20);
      }
      expect(a.window.orders).toBeGreaterThanOrEqual(
        Math.min(...a.hits.map((h) => ORDER_RULES[h.key].minOrders)),
      );
      expect(a.excessSpend).toBeGreaterThanOrEqual(0);
      expect(a.status).toBe("Open");
    }
  });

  it("calls an alert High only on two rules or a rate four times the usual", () => {
    for (const a of alerts) {
      if (a.severity === "High") expect(a.hits.length >= 2 || a.ratio >= 4).toBe(true);
      else expect(a.hits.length === 1 && a.ratio < 4).toBe(true);
    }
  });

  it("finds the service that quadrupled its agency shifts", () => {
    const a = alerts.find((x) => x.service === "ICU" && x.item === "Agency nursing" && x.facility === "LIL");
    expect(a).toBeDefined();
    expect(a!.severity).toBe("High");
    expect(a!.ratio).toBeGreaterThan(3);
    expect(a!.hits.map((h) => h.key).sort()).toEqual(["peer", "rate"]);
  });

  it("finds the repeat orders placed within a few days", () => {
    const a = alerts.find((x) => x.service === "Radiology" && x.item === "Contrast media" && x.facility === "LYO");
    expect(a).toBeDefined();
    expect(a!.hits.map((h) => h.key)).toContain("burst");
  });
});

/* A hand-built ledger, so each rule can be tested on its own. */
const order = (over: Partial<ServiceOrder> & { placed: string }): ServiceOrder => ({
  id: "ORD-X" + Math.random().toString(36).slice(2, 8),
  service: "Laboratory",
  facility: "PAR",
  item: "Reagent kits",
  category: "Laboratory",
  qty: 1,
  unit: "kit",
  unitPrice: 168,
  amount: 168,
  supplier: "SUP-1",
  requester: "EMP-0001",
  channel: "Direct requisition",
  po: null,
  status: "Delivered",
  ...over,
});

const spread = (n: number, fromDay: number, toDay: number, over: Partial<ServiceOrder> = {}) =>
  Array.from({ length: n }, (_, i) =>
    order({ ...over, placed: iso(dayAdd(-(fromDay + Math.floor((i * (toDay - fromDay)) / Math.max(1, n - 1))))) }),
  );

describe("each rule on its own", () => {
  it("leaves a service alone when it orders the same as always", () => {
    const steady = [
      ...spread(10, 1, WINDOW_DAYS - 1),
      ...spread(30, WINDOW_DAYS + 1, WINDOW_DAYS + BASELINE_DAYS - 1),
    ];
    expect(buildOrderAlerts(steady)).toHaveLength(0);
  });

  it("leaves a quiet service alone however lopsided its handful of orders", () => {
    // Three orders this quarter against one last year is a 9x rate, and it
    // must still say nothing: the minimum order counts exist for this.
    const tiny = [...spread(3, 5, 60), ...spread(1, 200, 200)];
    expect(buildOrderAlerts(tiny)).toHaveLength(0);
  });

  it("flags a service that tripled against its own history", () => {
    const tripled = [
      ...spread(24, 1, WINDOW_DAYS - 1),
      ...spread(24, WINDOW_DAYS + 1, WINDOW_DAYS + BASELINE_DAYS - 1),
    ];
    const [a] = buildOrderAlerts(tripled);
    expect(a.hits.map((h) => h.key)).toContain("rate");
    expect(a.ratio).toBeGreaterThanOrEqual(ORDER_RULES.rate.factor!);
    expect(a.excessSpend).toBeGreaterThan(0);
  });

  it("flags a site ordering far above the same service elsewhere", () => {
    const here = spread(30, 1, WINDOW_DAYS - 1);
    // Same beds-per-order story at three other sites, an order of magnitude lower.
    const peers = FACILITIES.slice(1).flatMap((f) => spread(2, 1, WINDOW_DAYS - 1, { facility: f.id }));
    const hits = buildOrderAlerts([...here, ...peers]).find((a) => a.facility === "PAR")!.hits;
    expect(hits.map((h) => h.key)).toContain("peer");
  });

  it("flags repeat orders in one week but not an ordinary week's worth", () => {
    // Eight orders inside three days, against a service that otherwise orders
    // twice a month: a duplicate requisition, not a busy week.
    const burst = [...spread(8, 20, 22), ...spread(6, 30, WINDOW_DAYS - 1)];
    expect(buildOrderAlerts(burst).some((a) => a.hits.some((h) => h.key === "burst"))).toBe(true);

    // The same total, spread evenly, is just how this service orders.
    const even = spread(14, 1, WINDOW_DAYS - 1);
    expect(buildOrderAlerts(even).some((a) => a.hits.some((h) => h.key === "burst"))).toBe(false);
  });
});
